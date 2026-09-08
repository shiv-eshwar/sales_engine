import { describe, expect, it } from "vitest";
import { applyTransportStatus } from "../../src/server/calls/ledger.js";
import { insertUtterance } from "../../src/server/transcript/utterances.js";
import { EXAMPLE_HEADERS } from "../../src/server/sheets/fixture.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import { getProposal } from "../../src/server/review/store.js";
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

describe("Post-call CRM hardening", () => {
  async function startSession(llm: FakeLlmClient, leadId = "L-100") {
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
    return { app, cookie, ctx, sessionId };
  }

  function connectSession(ctx: ReturnType<typeof getAppContext>, sessionId: string) {
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
  }

  it("keeps the extraction when one criterion lacks grounded evidence instead of discarding everything", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      postCallOutput({
        criteria: {
          relevant_problem: { state: "yes", evidence: "verify user-facing behavior by hand", confidence: 0.8 },
          meaningful_cost: { state: "yes", evidence: "operates five hundred doors on AppFolio", confidence: 0.9 },
          influence: { state: "unknown", evidence: null, confidence: 0 },
          timing: { state: "unknown", evidence: null, confidence: 0 }
        }
      })
    );
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    connectSession(ctx, sessionId);
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/finalize`,
      headers: { cookie }
    });
    expect(finalized.statusCode).toBe(200);
    const proposal = finalized.json() as {
      semanticOutcome: string;
      summary: string;
      warnings: string[];
      criteria: Array<{ id: string; state: string }>;
    };
    // Regression: this used to come back as conversation_incomplete with
    // "Post-call extraction was skipped or failed." because the whole LLM
    // outcome was discarded over one ungrounded criterion.
    expect(proposal.semanticOutcome).toBe("permission_to_follow_up");
    expect(proposal.summary).toContain("manual verification");
    expect(proposal.criteria.find((c) => c.id === "relevant_problem")?.state).toBe("yes");
    expect(proposal.criteria.find((c) => c.id === "meaningful_cost")?.state).toBe("unknown");
    expect(proposal.warnings.join(" ")).toMatch(/reset to unknown|grounded/i);
    await app.close();
  });

  it("preserves operator edits across a failed Sheet write and applies them on retry", async () => {
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
    connectSession(ctx, sessionId);
    const store = ctx.adapter?.store as MemorySheetStore;
    const original = store.batchUpdate.bind(store);
    store.batchUpdate = async () => {
      const error = new Error("Sheets API 503 Service Unavailable") as Error & { code?: number };
      error.code = 503;
      throw error;
    };
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
      payload: { fields: { call_summary: "Operator edited summary", next_step: "Call back Tuesday" } }
    });
    expect(failed.statusCode).toBe(200);
    expect((failed.json() as { proposal: { status: string } }).proposal.status).toBe("pending_retry");
    // Regression: edits used to live only in memory and were lost on retry.
    const stored = getProposal(ctx.db, proposal.id);
    expect(stored).not.toBeNull();
    expect(stored!.proposed_json).toContain("Operator edited summary");
    store.batchUpdate = original;
    const retried = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposal.id}/retry-write`,
      headers: { cookie }
    });
    expect(retried.statusCode).toBe(200);
    expect((retried.json() as { proposal: { status: string } }).proposal.status).toBe("applied");
    const rows = await store.getDataRows();
    const row = rows.find((item) => item.values[0] === "L-100");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Call Summary")]).toBe("Operator edited summary");
    expect(row?.values[EXAMPLE_HEADERS.indexOf("Next Step")]).toBe("Call back Tuesday");
    await app.close();
  });

  it("retries transient Sheet failures instead of failing the CRM update", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(postCallOutput());
    const { app, cookie, ctx, sessionId } = await startSession(llm);
    connectSession(ctx, sessionId);
    const store = ctx.adapter?.store as MemorySheetStore;
    let attempts = 0;
    const original = store.batchUpdate.bind(store);
    store.batchUpdate = async (updates) => {
      attempts += 1;
      if (attempts <= 2) {
        const error = new Error("Sheets API 503 Service Unavailable") as Error & { code?: number };
        error.code = 503;
        throw error;
      }
      return original(updates);
    };
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
    expect((approved.json() as { proposal: { status: string } }).proposal.status).toBe("applied");
    expect(attempts).toBe(3);
    await app.close();
  });
});
