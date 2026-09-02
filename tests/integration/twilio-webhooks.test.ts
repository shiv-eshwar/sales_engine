import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import { loginCookie, startTestApp, TEST_AUTH_TOKEN } from "../helpers/app.js";

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

describe("Twilio call sessions and webhooks", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>["app"];
  let cookie = "";

  beforeAll(async () => {
    ({ app } = await startTestApp());
    cookie = await loginCookie(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("maps one lead to one session and TwiML dials the stored E.164 not a client number", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
    });
    expect(created.statusCode).toBe(201);
    const session = created.json() as { id: string; leadId: string; phoneE164: string };
    expect(session.leadId).toBe("L-100");
    expect(session.phoneE164).toBe("+14155550100");

    const second = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-101", campaignId: "lamina-sales" }
    });
    expect(second.statusCode).toBe(409);

    const twiml = await app.inject({
      method: "POST",
      url: "/twilio/voice/outbound",
      ...signedForm("/twilio/voice/outbound", {
        sessionId: session.id,
        CallSid: "CAparent1",
        To: "+19995550199",
        CallStatus: "ringing"
      })
    });
    expect(twiml.statusCode).toBe(200);
    expect(twiml.body).toContain("+14155550100");
    expect(twiml.body).not.toContain("+19995550199");
    expect(twiml.body).toContain("<Dial");
    expect(twiml.body).toContain("<Stream");
    expect(twiml.body).toContain("record-from-answer-dual");
  });

  it("rejects unsigned webhooks", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/twilio/voice/status",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ CallSid: "CAparent1", CallStatus: "completed" }).toString()
    });
    expect(response.statusCode).toBe(403);
  });

  it("is idempotent for duplicate status callbacks and ignores delayed in-progress after completed", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-101", campaignId: "lamina-sales" }
    });
    // previous test left an active session; cancel it first if 409
    let sessionId = (created.json() as { id?: string; sessionId?: string }).id;
    if (created.statusCode === 409) {
      const cancelId = (created.json() as { sessionId: string }).sessionId;
      await app.inject({ method: "POST", url: `/api/calls/${cancelId}/cancel`, headers: { cookie } });
      const retry = await app.inject({
        method: "POST",
        url: "/api/calls/sessions",
        headers: { cookie },
        payload: { leadId: "L-101", campaignId: "lamina-sales" }
      });
      expect(retry.statusCode).toBe(201);
      sessionId = (retry.json() as { id: string }).id;
    }
    expect(sessionId).toBeTruthy();

    await app.inject({
      method: "POST",
      url: "/twilio/voice/outbound",
      ...signedForm("/twilio/voice/outbound", {
        sessionId: sessionId ?? "",
        CallSid: "CAparent2",
        CallStatus: "queued"
      })
    });

    const completed = {
      CallSid: "CAparent2",
      CallStatus: "completed",
      sessionId: sessionId ?? ""
    };
    const first = await app.inject({
      method: "POST",
      url: "/twilio/voice/status",
      ...signedForm("/twilio/voice/status", completed)
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/twilio/voice/status",
      ...signedForm("/twilio/voice/status", completed)
    });
    expect(first.statusCode).toBe(204);
    expect(duplicate.statusCode).toBe(204);

    const late = await app.inject({
      method: "POST",
      url: "/twilio/voice/status",
      ...signedForm("/twilio/voice/status", {
        CallSid: "CAparent2",
        CallStatus: "in-progress",
        sessionId: sessionId ?? ""
      })
    });
    expect(late.statusCode).toBe(204);

    const loaded = await app.inject({
      method: "GET",
      url: `/api/calls/${sessionId}`,
      headers: { cookie }
    });
    expect(loaded.json()).toMatchObject({ status: "completed", transportOutcome: "completed" });
  });

  it("rejects creating a session for a non-dialable lead", async () => {
    const active = await app.inject({ method: "GET", url: "/api/calls/active", headers: { cookie } });
    const current = (active.json() as { call: { id: string } | null }).call;
    if (current) {
      await app.inject({ method: "POST", url: `/api/calls/${current.id}/cancel`, headers: { cookie } });
    }
    const response = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-102", campaignId: "lamina-sales" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Lead phone is not dialable" });
  });

  it("treats duplicate number-status callbacks as one update", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
    });
    expect(created.statusCode).toBe(201);
    const sessionId = (created.json() as { id: string }).id;
    await app.inject({
      method: "POST",
      url: "/twilio/voice/outbound",
      ...signedForm("/twilio/voice/outbound", {
        sessionId,
        CallSid: "CAparent3",
        CallStatus: "queued"
      })
    });
    const ringing = {
      CallSid: "CAchild3",
      ParentCallSid: "CAparent3",
      CallStatus: "ringing",
      DialCallSid: "CAchild3"
    };
    const first = await app.inject({
      method: "POST",
      url: "/twilio/voice/number-status",
      ...signedForm("/twilio/voice/number-status", ringing)
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/twilio/voice/number-status",
      ...signedForm("/twilio/voice/number-status", ringing)
    });
    expect(first.statusCode).toBe(204);
    expect(duplicate.statusCode).toBe(204);
    const loaded = await app.inject({
      method: "GET",
      url: `/api/calls/${sessionId}`,
      headers: { cookie }
    });
    expect(loaded.json()).toMatchObject({ status: "ringing" });
    await app.inject({ method: "POST", url: `/api/calls/${sessionId}/cancel`, headers: { cookie } });
  });
});
