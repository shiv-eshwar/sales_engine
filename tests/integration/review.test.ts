import { describe, expect, it } from "vitest";
import { applyTransportStatus } from "../../src/server/calls/ledger.js";
import { insertUtterance } from "../../src/server/transcript/utterances.js";
import { EXAMPLE_HEADERS } from "../../src/server/sheets/fixture.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import {
  extractStreamToken,
  getAppContext,
  loginCookie,
  startTestApp,
  TEST_AUTH_TOKEN
} from "../helpers/app.js";
import { createFakeDeepgramFactory, type FakeDeepgramConnection } from "../helpers/deepgram.js";
import { FakeLlmClient, postCallOutput } from "../helpers/llm.js";

function signedForm(path: string, params: Record<string, string>) {
  const url = `http://127.0.0.1:3000${path}`;
  return {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": expectedTwilioSignature(TEST_AUTH_TOKEN, url, params)
    },
    payload: new URLSearchParams(params).toString()
  };
}

describe("Post-call CRM update", () => {
  async function startSession(
    llm: FakeLlmClient,
    leadId = "L-100"
  ) {
    const fakes: FakeDeepgramConnection[] = [];
    const { app } = await startTestApp({}, { deepgramFactory: createFakeDeepgramFactory(fakes), llmClient: llm });
    const cookie = await loginCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId, campaignId: "lamina-sales" }
    });
    expect(created.statusCode).toBe(201);
    const sessionId = (created.json() as { id: string }).id;
    const twiml = await app.inject({
      method: "POST",
      url: "/twilio/voice/outbound",
      ...signedForm("/twilio/voice/outbound", {
        sessionId,
        CallSid: `CA${sessionId.slice(0, 8)}`,
        CallStatus: "queued"
      })
    });
    const ctx = getAppContext(app);
    const socket = ctx.mediaHub.createSocket();
    socket.handle({
      event: "start",
      start: {
        tracks: ["inbound", "outbound"],
        customParameters: { streamToken: extractStreamToken(twiml.body), sessionId }
      }
    });
    return { app, cookie, ctx, sessionId, fakes, socket };
  }

  it("does not invoke the LLM for no-answer, busy, or failed outcomes", async () => {
    const llm = new FakeLlmClient();
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    applyTransportStatus(ctx.db, sessionId, "no-answer");
    const before = llm.calls.length;
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/finalize`,
      headers: { cookie }
    });
    expect(finalized.statusCode).toBe(200);
    const proposal = finalized.json() as { kind: string; semanticOutcome: string };
    expect(proposal.kind).toBe("non_connect");
    expect(llm.calls.length).toBe(before);

    for (const status of ["busy", "failed"] as const) {
      const next = await startSession(llm, "L-101");
      applyTransportStatus(next.ctx.db, next.sessionId, status);
      const result = await next.app.inject({
        method: "POST",
        url: `/api/calls/${next.sessionId}/finalize`,
        headers: { cookie: next.cookie }
      });
      expect(result.statusCode).toBe(200);
      expect((result.json() as { kind: string }).kind).toBe("non_connect");
      await next.app.close();
    }
    expect(llm.calls.length).toBe(before);
    await app.close();
  });

  it("does not write a semantic proposal before approval", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      postCallOutput({
        criteria: {
          relevant_problem: { state: "yes", evidence: "verify user-facing behavior by hand", confidence: 0.8 },
          meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
          influence: { state: "unknown", evidence: null, confidence: 0 },
          timing: { state: "unknown", evidence: null, confidence: 0 }
        }
      })
    );
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    applyTransportStatus(ctx.db, sessionId, "in_progress");
    applyTransportStatus(ctx.db, sessionId, "completed");
    insertUtterance(ctx.db, {
      sessionId,
      speaker: "contact",
      text: "we currently verify user-facing behavior by hand every week",
      startMs: 0,
      endMs: 1200,
      confidence: 0.9
    });
    const store = ctx.adapter?.store as MemorySheetStore;
    const writesBefore = store.writeCount;
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/finalize`,
      headers: { cookie }
    });
    expect(finalized.statusCode).toBe(200);
    const proposal = finalized.json() as { id: string; semanticOutcome: string; proposedFields: { call_summary: string } };
    expect(proposal.semanticOutcome).toBe("permission_to_follow_up");
    expect(store.writeCount).toBe(writesBefore);
    const queue = await ctx.adapter?.loadQueue();
    expect(queue?.leads.some((lead) => lead.leadId === "L-100")).toBe(true);
    expect(proposal.proposedFields.call_summary).toContain("manual verification");
    await app.close();
  });

  it("writes one allowlisted batch on approve and verifies it", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      postCallOutput({
        criteria: {
          relevant_problem: { state: "yes", evidence: "verify user-facing behavior by hand", confidence: 0.8 },
          meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
          influence: { state: "unknown", evidence: null, confidence: 0 },
          timing: { state: "unknown", evidence: null, confidence: 0 }
        }
      })
    );
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    applyTransportStatus(ctx.db, sessionId, "in_progress");
    applyTransportStatus(ctx.db, sessionId, "completed");
    insertUtterance(ctx.db, {
      sessionId,
      speaker: "contact",
      text: "we currently verify user-facing behavior by hand",
      startMs: 0,
      endMs: 1000,
      confidence: 0.9
    });
    const store = ctx.adapter?.store as MemorySheetStore;
    const writesBefore = store.writeCount;
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/finalize`,
      headers: { cookie }
    });
    const proposal = finalized.json() as { id: string };
    const approved = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie },
      payload: {}
    });
    expect(approved.statusCode).toBe(200);
    const body = approved.json() as { proposal: { status: string }; lead: { leadId: string } | null };
    expect(body.proposal.status).toBe("applied");
    expect(store.writeCount).toBe(writesBefore + 1);
    const rows = await store.getDataRows();
    const row = rows.find((item) => item.values[0] === "L-100");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Outcome")]).toBe("permission_to_follow_up");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Status")]).toBe("Completed");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Summary")]).toContain("manual verification");
    expect(body.lead?.leadId).not.toBe("L-100");
    await app.close();
  });

  it("keeps a failed Sheet write pending and retries without duplication", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      postCallOutput({
        criteria: {
          relevant_problem: { state: "yes", evidence: "verify user-facing behavior by hand", confidence: 0.8 },
          meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
          influence: { state: "unknown", evidence: null, confidence: 0 },
          timing: { state: "unknown", evidence: null, confidence: 0 }
        }
      })
    );
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    applyTransportStatus(ctx.db, sessionId, "in_progress");
    applyTransportStatus(ctx.db, sessionId, "completed");
    insertUtterance(ctx.db, {
      sessionId,
      speaker: "contact",
      text: "we currently verify user-facing behavior by hand",
      startMs: 0,
      endMs: 1000,
      confidence: 0.9
    });
    const store = ctx.adapter?.store as MemorySheetStore;
    store.failNextWrite();
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/finalize`,
      headers: { cookie }
    });
    const proposal = finalized.json() as { id: string };
    const failed = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie },
      payload: {}
    });
    expect(failed.statusCode).toBe(200);
    expect((failed.json() as { proposal: { status: string; lastError: string } }).proposal.status).toBe("pending_retry");
    const count = ctx.db.prepare("SELECT COUNT(*) AS n FROM post_call_proposals WHERE session_id = ?").get(sessionId) as {
      n: number;
    };
    expect(count.n).toBe(1);
    const retried = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/retry-write`,
      headers: { cookie }
    });
    expect(retried.statusCode).toBe(200);
    expect((retried.json() as { proposal: { status: string } }).proposal.status).toBe("applied");
    const after = ctx.db.prepare("SELECT COUNT(*) AS n FROM post_call_proposals WHERE session_id = ?").get(sessionId) as {
      n: number;
    };
    expect(after.n).toBe(1);
    const rows = await store.getDataRows();
    const summaries = rows.filter((item) => item.values[0] === "L-100");
    expect(summaries).toHaveLength(1);
    await app.close();
  });

  it("leaves Gumloop-owned cells intact when they change during the call", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      postCallOutput({
        criteria: {
          relevant_problem: { state: "yes", evidence: "verify user-facing behavior by hand", confidence: 0.8 },
          meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
          influence: { state: "unknown", evidence: null, confidence: 0 },
          timing: { state: "unknown", evidence: null, confidence: 0 }
        }
      })
    );
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    applyTransportStatus(ctx.db, sessionId, "in_progress");
    const store = ctx.adapter?.store as MemorySheetStore;
    await store.batchUpdate([
      {
        rowNumber: 2,
        columnIndex: EXAMPLE_HEADERS.indexOf("Enrichment"),
        header: "Enrichment",
        value: "Changed by Gumloop during the call"
      }
    ]);
    applyTransportStatus(ctx.db, sessionId, "completed");
    insertUtterance(ctx.db, {
      sessionId,
      speaker: "contact",
      text: "we currently verify user-facing behavior by hand",
      startMs: 0,
      endMs: 1000,
      confidence: 0.9
    });
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/finalize`,
      headers: { cookie }
    });
    const proposal = finalized.json() as { id: string };
    const approved = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie },
      payload: {}
    });
    expect(approved.statusCode).toBe(200);
    const rows = await store.getDataRows();
    const row = rows.find((item) => item.values[0] === "L-100");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Enrichment")]).toBe("Changed by Gumloop during the call");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Summary")]).toContain("manual verification");
    await app.close();
  });

  it("writes DNC suppression so the lead is no longer eligible", async () => {
    const llm = new FakeLlmClient();
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    applyTransportStatus(ctx.db, sessionId, "in_progress");
    applyTransportStatus(ctx.db, sessionId, "completed");
    insertUtterance(ctx.db, {
      sessionId,
      speaker: "contact",
      text: "please do not contact me ever again",
      startMs: 0,
      endMs: 800,
      confidence: 0.9
    });
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/finalize`,
      headers: { cookie }
    });
    expect(finalized.statusCode).toBe(200);
    const proposal = finalized.json() as { id: string; semanticOutcome: string };
    expect(proposal.semanticOutcome).toBe("do_not_contact");
    expect(llm.calls.length).toBe(0);
    const approved = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/approve`,
      headers: { cookie },
      payload: {}
    });
    expect(approved.statusCode).toBe(200);
    const queue = await ctx.adapter?.loadQueue();
    expect(queue?.leads.some((lead) => lead.leadId === "L-100")).toBe(false);
    await app.close();
  });
});
