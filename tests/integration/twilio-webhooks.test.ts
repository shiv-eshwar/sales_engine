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

  it("routes inbound callers to the operator client and tracks the dial leg", async () => {
    const { app: inboundApp } = await startTestApp();
    try {
      const inboundCookie = await loginCookie(inboundApp);
      const inbound = await inboundApp.inject({
        method: "POST",
        url: "/twilio/voice/inbound",
        ...signedForm("/twilio/voice/inbound", {
          From: "+14155550100",
          To: "+14155550000",
          CallSid: "CAinbound1",
          CallStatus: "ringing"
        })
      });
    expect(inbound.statusCode).toBe(200);
    expect(inbound.body).toContain("<Client");
    expect(inbound.body).toContain(">operator<");
    expect(inbound.body).toContain('name="sessionId"');
    expect(inbound.body).toContain("<Stream");

    const listed = await inboundApp.inject({ method: "GET", url: "/api/calls/active", headers: { cookie: inboundCookie } });
    const active = listed.json() as { call: { id: string; status: string; contactName: string } | null };
    expect(active.call?.status).toBe("ringing");
    // Known sheet number resolves to the lead name.
    expect(active.call?.contactName).toBe("Alex Rivera");

    const answered = await inboundApp.inject({
      method: "POST",
      url: "/twilio/voice/inbound-status",
      ...signedForm("/twilio/voice/inbound-status", {
        CallSid: "CAclientLeg1",
        ParentCallSid: "CAinbound1",
        CallStatus: "in-progress"
      })
    });
    expect(answered.statusCode).toBe(204);
    const connected = await inboundApp.inject({ method: "GET", url: "/api/calls/active", headers: { cookie: inboundCookie } });
    expect((connected.json() as { call: { status: string } }).call.status).toBe("in_progress");

    // A second caller hears the busy message while the operator is on the call.
    const busy = await inboundApp.inject({
      method: "POST",
      url: "/twilio/voice/inbound",
      ...signedForm("/twilio/voice/inbound", {
        From: "+14155550999",
        To: "+14155550000",
        CallSid: "CAinbound2",
        CallStatus: "ringing"
      })
    });
    expect(busy.statusCode).toBe(200);
    expect(busy.body).toContain("another call");
    expect(busy.body).not.toContain("<Client>");

    const done = await inboundApp.inject({
      method: "POST",
      url: "/twilio/voice/inbound-status",
      ...signedForm("/twilio/voice/inbound-status", {
        CallSid: "CAinbound1",
        DialCallSid: "CAclientLeg1",
        DialCallStatus: "completed"
      })
    });
    expect(done.statusCode).toBe(204);
    const idle = await inboundApp.inject({ method: "GET", url: "/api/calls/active", headers: { cookie: inboundCookie } });
    expect((idle.json() as { call: null }).call).toBeNull();
    } finally {
      await inboundApp.close();
    }
  });

  it("simultaneous-rings the forward number with the browser when configured", async () => {
    const { app: fwdApp } = await startTestApp({ INBOUND_FORWARD_NUMBER: "+919876543210" });
    try {
      const inbound = await fwdApp.inject({
        method: "POST",
        url: "/twilio/voice/inbound",
        ...signedForm("/twilio/voice/inbound", {
          From: "+14155550100",
          To: "+14155550000",
          CallSid: "CAfwd1",
          CallStatus: "ringing"
        })
      });
      expect(inbound.statusCode).toBe(200);
      expect(inbound.body).toContain(">operator<");
      expect(inbound.body).toContain("+919876543210");

      // Mobile answers: the PSTN leg steals the tracked leg and connects.
      const answered = await fwdApp.inject({
        method: "POST",
        url: "/twilio/voice/inbound-status",
        ...signedForm("/twilio/voice/inbound-status", {
          CallSid: "CAfwdMobile",
          ParentCallSid: "CAfwd1",
          CallStatus: "in-progress"
        })
      });
      expect(answered.statusCode).toBe(204);

      // Losing browser leg hangs up: must not end the connected call.
      const loser = await fwdApp.inject({
        method: "POST",
        url: "/twilio/voice/inbound-status",
        ...signedForm("/twilio/voice/inbound-status", {
          CallSid: "CAfwdBrowser",
          ParentCallSid: "CAfwd1",
          CallStatus: "completed"
        })
      });
      expect(loser.statusCode).toBe(204);
      const listed = await fwdApp.inject({ method: "GET", url: "/api/calls/active", headers: { cookie: await loginCookie(fwdApp) } });
      expect((listed.json() as { call: { status: string } }).call.status).toBe("in_progress");
    } finally {
      await fwdApp.close();
    }
  });

  it("ignores a missing or invalid forward number", async () => {
    for (const override of [{}, { INBOUND_FORWARD_NUMBER: "not-a-number" }] as const) {
      const { app: plainApp } = await startTestApp(override);
      try {
        const inbound = await plainApp.inject({
          method: "POST",
          url: "/twilio/voice/inbound",
          ...signedForm("/twilio/voice/inbound", {
            From: "+14155550100",
            To: "+14155550000",
            CallSid: `CAplain${Math.random()}`,
            CallStatus: "ringing"
          })
        });
        expect(inbound.statusCode).toBe(200);
        expect(inbound.body).toContain(">operator<");
        expect(inbound.body).not.toContain("<Number");
      } finally {
        await plainApp.close();
      }
    }
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
