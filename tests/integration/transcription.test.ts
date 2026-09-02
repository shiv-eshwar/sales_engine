import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyTransportStatus, getSession } from "../../src/server/calls/ledger.js";
import { listUtterances } from "../../src/server/transcript/utterances.js";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import {
  extractStreamToken,
  getAppContext,
  loginCookie,
  startTestApp,
  TEST_AUTH_TOKEN
} from "../helpers/app.js";
import { createFakeDeepgramFactory, type FakeDeepgramConnection } from "../helpers/deepgram.js";

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

describe("Recording and transcription", () => {
  const fakes: FakeDeepgramConnection[] = [];
  let app: Awaited<ReturnType<typeof startTestApp>>["app"];
  let cookie = "";

  beforeAll(async () => {
    ({ app } = await startTestApp({}, { deepgramFactory: createFakeDeepgramFactory(fakes) }));
    cookie = await loginCookie(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function cancelActive(): Promise<void> {
    const active = await app.inject({ method: "GET", url: "/api/calls/active", headers: { cookie } });
    const current = (active.json() as { call: { id: string } | null }).call;
    if (current) {
      await app.inject({ method: "POST", url: `/api/calls/${current.id}/cancel`, headers: { cookie } });
    }
  }

  async function createLiveSession(leadId = "L-100") {
    await cancelActive();
    fakes.length = 0;
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId, campaignId: "lamina-sales" }
    });
    expect(created.statusCode).toBe(201);
    const session = created.json() as { id: string };
    const twiml = await app.inject({
      method: "POST",
      url: "/twilio/voice/outbound",
      ...signedForm("/twilio/voice/outbound", {
        sessionId: session.id,
        CallSid: `CA${session.id.slice(0, 8)}`,
        CallStatus: "queued"
      })
    });
    expect(twiml.statusCode).toBe(200);
    return { sessionId: session.id, token: extractStreamToken(twiml.body), twiml: twiml.body };
  }

  it("starts a dual-track stream and dual-channel recording without putting secrets in the URL", async () => {
    const { twiml } = await createLiveSession("L-100");
    expect(twiml).toContain("<Stream");
    expect(twiml).toContain("both_tracks");
    expect(twiml).toContain("/twilio/media");
    expect(twiml).toContain("streamToken");
    expect(twiml).not.toMatch(/\/twilio\/media[^"<]*streamToken/);
    expect(twiml).not.toContain(TEST_AUTH_TOKEN);
    expect(twiml).toContain("record-from-answer-dual");
    expect(twiml).toContain("/twilio/recording/status");
  });

  it("stores Recording SID once and never persists a media URL", async () => {
    const { sessionId } = await createLiveSession("L-101");
    const parentSid = `CA${sessionId.slice(0, 8)}`;
    const params = {
      RecordingSid: "RE11111111111111111111111111111111",
      RecordingStatus: "completed",
      CallSid: parentSid,
      RecordingUrl: "https://api.twilio.com/recordings/RE111?auth=secret"
    };
    const first = await app.inject({
      method: "POST",
      url: "/twilio/recording/status",
      ...signedForm("/twilio/recording/status", params)
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/twilio/recording/status",
      ...signedForm("/twilio/recording/status", params)
    });
    expect(first.statusCode).toBe(204);
    expect(duplicate.statusCode).toBe(204);
    const loaded = await app.inject({
      method: "GET",
      url: `/api/calls/${sessionId}`,
      headers: { cookie }
    });
    expect(loaded.json()).toMatchObject({ recordingSid: "RE11111111111111111111111111111111" });
    expect(loaded.body).not.toContain("api.twilio.com");
    expect(loaded.body).not.toContain("auth=secret");
  });

  it("rejects unsigned recording callbacks", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/twilio/recording/status",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        RecordingSid: "RE222",
        RecordingStatus: "completed",
        CallSid: "CAignored"
      }).toString()
    });
    expect(response.statusCode).toBe(403);
  });

  it("rejects unknown or invalid stream tokens", async () => {
    const ctx = getAppContext(app);
    const socket = ctx.mediaHub.createSocket();
    const decision = socket.handle({
      event: "start",
      start: {
        tracks: ["inbound", "outbound"],
        customParameters: { streamToken: "not-a-real-token" }
      }
    });
    expect(decision).toEqual({ action: "close", code: 4403, reason: "Invalid stream token" });
  });

  it("attributes final utterances to caller and contact and ignores interim text", async () => {
    const { sessionId, token } = await createLiveSession("L-100");
    const ctx = getAppContext(app);
    const socket = ctx.mediaHub.createSocket();
    expect(
      socket.handle({
        event: "start",
        start: {
          tracks: ["inbound", "outbound"],
          customParameters: { streamToken: token, sessionId }
        }
      })
    ).toEqual({ action: "ok" });
    expect(fakes).toHaveLength(2);
    fakes[0]?.open();
    fakes[1]?.open();
    fakes[0]?.emitInterim("hel");
    fakes[1]?.emitInterim("wor");
    expect(listUtterances(ctx.db, sessionId)).toEqual([]);
    fakes[0]?.emitFinal("hello from caller", 10, 40);
    fakes[1]?.emitFinal("hello from contact", 50, 90);
    const stored = listUtterances(ctx.db, sessionId);
    expect(stored).toHaveLength(2);
    expect(stored.map((row) => ({ speaker: row.speaker, text: row.text }))).toEqual([
      { speaker: "caller", text: "hello from caller" },
      { speaker: "contact", text: "hello from contact" }
    ]);
    const loaded = await app.inject({
      method: "GET",
      url: `/api/calls/${sessionId}`,
      headers: { cookie }
    });
    expect(loaded.json()).toMatchObject({
      transcriptionHealth: "ok",
      utterances: [
        { speaker: "caller", text: "hello from caller", isFinal: true },
        { speaker: "contact", text: "hello from contact", isFinal: true }
      ]
    });
    await socket.stop();
  });

  it("marks transcription interrupted on Deepgram drop without ending the PSTN session", async () => {
    const { sessionId, token } = await createLiveSession("L-101");
    const ctx = getAppContext(app);
    applyTransportStatus(ctx.db, sessionId, "in_progress");
    const socket = ctx.mediaHub.createSocket();
    socket.handle({
      event: "start",
      start: {
        tracks: ["inbound", "outbound"],
        customParameters: { streamToken: token, sessionId }
      }
    });
    expect(fakes[0]).toBeTruthy();
    fakes[0]?.fail();
    expect(ctx.mediaHub.getHealth(sessionId)).toBe("interrupted");
    await vi.waitFor(() => {
      expect(fakes.length).toBeGreaterThanOrEqual(3);
    });
    fakes[2]?.fail();
    await vi.waitFor(() => {
      expect(fakes.length).toBeGreaterThanOrEqual(4);
    });
    fakes[3]?.fail();
    expect(ctx.mediaHub.getHealth(sessionId)).toBe("interrupted");
    expect(getSession(ctx.db, sessionId)?.status).toBe("in_progress");
    const canceled = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/cancel`,
      headers: { cookie }
    });
    expect(canceled.statusCode).toBe(200);
    expect(canceled.json()).toMatchObject({ status: "canceled" });
    await socket.stop();
  });

  it("sets transcript_complete false after stop when a gap remains", async () => {
    const { sessionId, token } = await createLiveSession("L-100");
    const ctx = getAppContext(app);
    const socket = ctx.mediaHub.createSocket();
    socket.handle({
      event: "start",
      start: {
        tracks: ["inbound", "outbound"],
        customParameters: { streamToken: token, sessionId }
      }
    });
    fakes[0]?.fail();
    await socket.stop();
    expect(getSession(ctx.db, sessionId)?.transcript_complete).toBe(0);
    const utterances = listUtterances(ctx.db, sessionId);
    expect(utterances.some((row) => row.text === "[gap]")).toBe(true);
  });

  it("closes the media websocket when the stream token is invalid", async () => {
    const ws = await app.injectWS("/twilio/media");
    const closed = new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });
    ws.send(
      JSON.stringify({
        event: "start",
        start: {
          tracks: ["inbound", "outbound"],
          customParameters: { streamToken: "invalid" }
        }
      })
    );
    await expect(closed).resolves.toBe(4403);
  });
});

describe("Missing Deepgram key", () => {
  it("accepts the media stream and marks transcription interrupted", async () => {
    const { app } = await startTestApp();
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
        CallSid: "CAmissingdg",
        CallStatus: "queued"
      })
    });
    const ctx = getAppContext(app);
    const socket = ctx.mediaHub.createSocket();
    const decision = socket.handle({
      event: "start",
      start: {
        tracks: ["inbound", "outbound"],
        customParameters: { streamToken: extractStreamToken(twiml.body), sessionId }
      }
    });
    expect(decision).toEqual({ action: "ok" });
    expect(ctx.mediaHub.getHealth(sessionId)).toBe("interrupted");
    await socket.stop();
    await app.close();
  });
});
