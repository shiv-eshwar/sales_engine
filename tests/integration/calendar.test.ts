import { describe, expect, it, vi } from "vitest";
import { applyTransportStatus } from "../../src/server/calls/ledger.js";
import { insertUtterance } from "../../src/server/transcript/utterances.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";
import { FakeCalendarClient } from "../../src/server/calendar/memory.js";
import { decryptSecret, encryptSecret } from "../../src/server/crypto/secret.js";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import {
  extractStreamToken,
  getAppContext,
  loginCookie,
  startTestApp,
  TEST_AUTH_TOKEN
} from "../helpers/app.js";
import { createFakeDeepgramFactory, type FakeDeepgramConnection } from "../helpers/deepgram.js";
import { coachOutput, FakeLlmClient, postCallOutput } from "../helpers/llm.js";

const START = "2026-09-17T18:00:00.000Z";
const END = "2026-09-17T18:30:00.000Z";

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

describe("Calendar proposals", () => {
  it("encrypts tokens at rest", () => {
    const secret = "test-session-secret-32-characters-min";
    const encoded = encryptSecret("refresh-token", secret);
    expect(encoded).not.toContain("refresh-token");
    expect(decryptSecret(encoded, secret)).toBe("refresh-token");
  });

  it("proposes without inserting, approves once, and dismisses", async () => {
    const calendar = new FakeCalendarClient({ connected: true });
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        cue: "Offer a 20-minute look Thursday afternoon.",
        calendarProposal: {
          title: "Ada Example / Example Co",
          start: START,
          end: END,
          timezone: "UTC",
          attendees: ["ada@example.com"],
          meet: true,
          notes: "Intro"
        }
      })
    );
    const fakes: FakeDeepgramConnection[] = [];
    const { app } = await startTestApp({}, { deepgramFactory: createFakeDeepgramFactory(fakes), llmClient: llm, calendarClient: calendar });
    const cookie = await loginCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
    });
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
    outbound?.emitFinal("thursday afternoon could work for a look");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(1);
    });

    const live = await app.inject({ method: "GET", url: `/api/calls/${sessionId}`, headers: { cookie } });
    const messages = (live.json() as { coachMessages: Array<{ calendarProposal: { id: string; status: string } | null }> }).coachMessages;
    const draft = messages.find((item) => item.calendarProposal)?.calendarProposal;
    expect(draft?.status).toBe("pending");
    expect(calendar.inserts).toHaveLength(0);

    const approved = await app.inject({
      method: "POST",
      url: `/api/calendar/proposals/${draft!.id}/approve`,
      headers: { cookie },
      payload: { attendees: ["ada@example.com"] }
    });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json().proposal.status).toBe("sent");
    expect(approved.json().proposal.intent).toBe("meeting");
    expect(calendar.inserts).toHaveLength(1);
    expect(calendar.inserts[0]?.sendUpdates).toBe("all");
    expect(calendar.inserts[0]?.attendees).toEqual(["ada@example.com"]);

    const again = await app.inject({
      method: "POST",
      url: `/api/calendar/proposals/${draft!.id}/approve`,
      headers: { cookie },
      payload: {}
    });
    expect(again.statusCode).toBe(200);
    expect(calendar.inserts).toHaveLength(1);

    llm.enqueueJson(
      coachOutput({
        basedOnSequence: 2,
        cue: "Park a backup slot.",
        calendarProposal: {
          title: "Backup",
          start: START,
          end: END,
          timezone: "UTC"
        }
      })
    );
    outbound?.emitFinal("maybe a second window too");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(2);
    });
    const listed = await app.inject({
      method: "GET",
      url: `/api/calls/${sessionId}/calendar/proposals`,
      headers: { cookie }
    });
    const pending = (listed.json() as { proposals: Array<{ id: string; status: string }> }).proposals.find((item) => item.status === "pending");
    expect(pending).toBeTruthy();
    const dismissed = await app.inject({
      method: "POST",
      url: `/api/calendar/proposals/${pending!.id}/dismiss`,
      headers: { cookie }
    });
    expect(dismissed.json().proposal.status).toBe("dismissed");
    expect(calendar.inserts).toHaveLength(1);
    await app.close();
  });

  it("lets call-review draft a calendar event without writing the Sheet", async () => {
    const calendar = new FakeCalendarClient({ connected: true });
    const llm = new FakeLlmClient();
    llm.enqueueJson(postCallOutput());
    const fakes: FakeDeepgramConnection[] = [];
    const { app } = await startTestApp({}, { deepgramFactory: createFakeDeepgramFactory(fakes), llmClient: llm, calendarClient: calendar });
    const cookie = await loginCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
    });
    const sessionId = (created.json() as { id: string }).id;
    const ctx = getAppContext(app);
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
    await app.inject({ method: "POST", url: `/api/calls/${sessionId}/finalize`, headers: { cookie } });
    llm.enqueueJson({
      message: "Drafted a 20-minute intro. Approve the card to send it.",
      action: "none",
      calendarProposal: {
        title: "Intro",
        start: START,
        end: END,
        timezone: "UTC",
        attendees: ["jordan@example.com"],
        meet: false
      }
    });
    const turn = await app.inject({
      method: "POST",
      url: `/api/calls/${sessionId}/review/interview`,
      headers: { cookie },
      payload: {
        messages: [{ role: "user", content: "book Thursday at 2" }]
      }
    });
    expect(turn.statusCode, turn.body).toBe(200);
    expect(turn.json().calendarProposal.status).toBe("pending");
    expect(turn.json().wrote).toBe(false);
    expect(store.writeCount).toBe(writesBefore);
    expect(calendar.inserts).toHaveLength(0);
    await app.close();
  });

  it("approves a callback without inviting the prospect", async () => {
    const calendar = new FakeCalendarClient({ connected: true });
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        cue: "Park a Wednesday callback.",
        calendarProposal: {
          intent: "callback",
          title: "Call Ada Rivera",
          start: START,
          end: END,
          timezone: "UTC",
          attendees: ["ada@example.com"],
          meet: true
        }
      })
    );
    const fakes: FakeDeepgramConnection[] = [];
    const { app } = await startTestApp({}, { deepgramFactory: createFakeDeepgramFactory(fakes), llmClient: llm, calendarClient: calendar });
    const cookie = await loginCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
    });
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
    outbound?.emitFinal("call me wednesday morning");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(1);
    });

    const live = await app.inject({ method: "GET", url: `/api/calls/${sessionId}`, headers: { cookie } });
    const messages = (live.json() as { coachMessages: Array<{ calendarProposal: { id: string; intent: string; attendees: string[] } | null }> }).coachMessages;
    const draft = messages.find((item) => item.calendarProposal)?.calendarProposal;
    expect(draft?.intent).toBe("callback");
    expect(draft?.attendees).toEqual([]);

    const approved = await app.inject({
      method: "POST",
      url: `/api/calendar/proposals/${draft!.id}/approve`,
      headers: { cookie },
      payload: {}
    });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(calendar.inserts).toHaveLength(1);
    expect(calendar.inserts[0]?.sendUpdates).toBe("none");
    expect(calendar.inserts[0]?.attendees).toEqual([]);
    expect(calendar.inserts[0]?.meet).toBe(false);
    await app.close();
  });

  it("drafts a meeting plus a linked morning-of reminder", async () => {
    const calendar = new FakeCalendarClient({ connected: true });
    const llm = new FakeLlmClient();
    llm.enqueueJson(
      coachOutput({
        cue: "Book Thursday and set a morning reminder.",
        calendarProposal: {
          intent: "meeting",
          title: "Ada / Example",
          start: START,
          end: END,
          timezone: "UTC",
          attendees: ["ada@example.com"],
          meet: true
        },
        calendarReminder: {
          title: "Call Ada before the meeting",
          start: "2026-09-17T14:00:00.000Z",
          end: "2026-09-17T14:15:00.000Z",
          timezone: "UTC"
        }
      })
    );
    const fakes: FakeDeepgramConnection[] = [];
    const { app } = await startTestApp({}, { deepgramFactory: createFakeDeepgramFactory(fakes), llmClient: llm, calendarClient: calendar });
    const cookie = await loginCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
    });
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
    outbound?.emitFinal("thursday at two works, ping me that morning");
    await vi.waitFor(() => {
      expect(llm.calls.length).toBe(1);
    });

    const listed = await app.inject({ method: "GET", url: `/api/calls/${sessionId}/calendar/proposals`, headers: { cookie } });
    const proposals = listed.json().proposals as Array<{ intent: string; linkedProposalId: string | null; id: string }>;
    expect(proposals).toHaveLength(2);
    const meeting = proposals.find((item) => item.intent === "meeting");
    const reminder = proposals.find((item) => item.intent === "reminder");
    expect(meeting).toBeDefined();
    expect(reminder?.linkedProposalId).toBe(meeting?.id);

    const approvedReminder = await app.inject({
      method: "POST",
      url: `/api/calendar/proposals/${reminder!.id}/approve`,
      headers: { cookie },
      payload: {}
    });
    expect(approvedReminder.statusCode, approvedReminder.body).toBe(200);
    expect(calendar.inserts[0]?.sendUpdates).toBe("none");
    await app.close();
  });
});

