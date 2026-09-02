import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTransportStatus, getSession } from "../../src/server/calls/ledger.js";
import { listCoachingEvents } from "../../src/server/coach/store.js";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import {
  extractStreamToken,
  getAppContext,
  loginCookie,
  startTestApp,
  TEST_AUTH_TOKEN
} from "../helpers/app.js";
import { createFakeDeepgramFactory, type FakeDeepgramConnection } from "../helpers/deepgram.js";
import { coachOutput, FakeLlmClient } from "../helpers/llm.js";

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

describe("Live coaching", () => {
  afterEach(async () => {
    vi.useRealTimers();
  });

  async function startCall(llm: FakeLlmClient) {
    const fakes: FakeDeepgramConnection[] = [];
    const { app } = await startTestApp({}, { deepgramFactory: createFakeDeepgramFactory(fakes), llmClient: llm });
    const cookie = await loginCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
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
    applyTransportStatus(ctx.db, sessionId, "in_progress");
    const socket = ctx.mediaHub.createSocket();
    socket.handle({
      event: "start",
      start: {
        tracks: ["inbound", "outbound"],
        customParameters: { streamToken: extractStreamToken(twiml.body), sessionId }
      }
    });
    const outbound = fakes.find((item) => item.speaker === "contact") ?? fakes[1];
    return { app, cookie, ctx, sessionId, outbound, socket };
  }

  it("shows a clarify cue for the first existing_solution objection and does not rebut", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        stage: "objection",
        cueType: "clarify",
        cue: "What does your current solution still miss?",
        detectedObjection: "existing_solution"
      })
    );
    const { app, cookie, sessionId, outbound } = await startCall(llm);
    outbound?.emitFinal("we already have an existing solution that covers this");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(1);
    });
    const loaded = await app.inject({ method: "GET", url: `/api/calls/${sessionId}`, headers: { cookie } });
    const body = loaded.json() as {
      status: string;
      coach: { cue: { cueType: string; text: string } | null };
    };
    expect(body.status).toBe("in_progress");
    expect(body.coach.cue?.cueType).toBe("clarify");
    expect(body.coach.cue?.text).toMatch(/current solution/i);
    await app.close();
  });

  it("discards a stale slower response when a newer sequence arrives", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(coachOutput({ basedOnSequence: 1, cue: "Old cue from sequence one" }), 80);
    llm.enqueueJson(coachOutput({ basedOnSequence: 2, cue: "Ask about a recent incident." }));
    const { app, cookie, sessionId, outbound } = await startCall(llm);
    outbound?.emitFinal("we ship web apps every week");
    outbound?.emitFinal("last month a checkout bug reached customers");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(2);
    });
    await vi.waitFor(async () => {
      const loaded = await app.inject({ method: "GET", url: `/api/calls/${sessionId}`, headers: { cookie } });
      const cue = (loaded.json() as { coach: { cue: { text: string; basedOnSequence: number } | null } }).coach.cue;
      expect(cue?.text).toBe("Ask about a recent incident.");
      expect(cue?.basedOnSequence).toBe(2);
    });
    await app.close();
  });

  it("produces no live cue on invalid model JSON and does not end the call", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueRaw("{not-json");
    const { app, cookie, ctx, sessionId, outbound } = await startCall(llm);
    outbound?.emitFinal("can you tell me more about what you do");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const loaded = await app.inject({ method: "GET", url: `/api/calls/${sessionId}`, headers: { cookie } });
    expect(loaded.json()).toMatchObject({ status: "in_progress", coach: { cue: null } });
    expect(listCoachingEvents(ctx.db, sessionId)).toHaveLength(0);
    expect(getSession(ctx.db, sessionId)?.status).toBe("in_progress");
    await app.close();
  });

  it("does not treat interim text as qualification evidence", async () => {
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        qualificationUpdates: [
          { criterion: "relevant_problem", state: "yes", evidence: "only in the interim", confidence: 0.9 }
        ]
      })
    );
    const { app, cookie, sessionId, outbound } = await startCall(llm);
    outbound?.emitInterim("only in the interim");
    outbound?.emitFinal("we are just browsing options today");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(1);
    });
    const loaded = await app.inject({ method: "GET", url: `/api/calls/${sessionId}`, headers: { cookie } });
    const qual = (
      loaded.json() as {
        coach: { qualification: Array<{ id: string; state: string }> };
      }
    ).coach.qualification;
    expect(qual.find((item) => item.id === "relevant_problem")?.state).toBe("unknown");
    await app.close();
  });
});
