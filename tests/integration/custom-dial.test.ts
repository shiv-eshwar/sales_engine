import { describe, expect, it } from "vitest";
import { applyTransportStatus, getSession } from "../../src/server/calls/ledger.js";
import { CUSTOM_DIAL_CAMPAIGN_ID } from "../../src/shared/customDial.js";
import { getProposalBySession } from "../../src/server/review/store.js";
import { getAppContext, loginCookie, startTestApp, TEST_AUTH_TOKEN } from "../helpers/app.js";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";

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

describe("custom dial", () => {
  it("places a server-validated number without a Sheet lead or CRM write", async () => {
    const { app } = await startTestApp();
    const cookie = await loginCookie(app);
    const ctx = getAppContext(app);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/calls/sessions/custom",
      headers: { cookie },
      payload: { phone: "not-a-phone" }
    });
    expect(invalid.statusCode).toBe(400);

    const foreign = await app.inject({
      method: "POST",
      url: "/api/calls/sessions/custom",
      headers: { cookie },
      payload: { phone: "+442071838750" }
    });
    expect(foreign.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions/custom",
      headers: { cookie },
      payload: { phone: "415-555-0199" }
    });
    expect(created.statusCode, created.body).toBe(201);
    const session = created.json() as {
      id: string;
      leadId: string;
      campaignId: string;
      phoneE164: string;
      customDial: boolean;
    };
    expect(session.campaignId).toBe(CUSTOM_DIAL_CAMPAIGN_ID);
    expect(session.customDial).toBe(true);
    expect(session.phoneE164).toBe("+14155550199");
    expect(session.leadId).toBe("custom:+14155550199");
    expect(getSession(ctx.db, session.id)?.operator_email).toBe("operator@test.local");

    const twiml = await app.inject({
      method: "POST",
      url: "/twilio/voice/outbound",
      ...signedForm("/twilio/voice/outbound", {
        sessionId: session.id,
        CallSid: "CAcustom1",
        To: "+19995550199",
        CallStatus: "queued"
      })
    });
    expect(twiml.statusCode).toBe(200);
    expect(twiml.body).toContain("+14155550199");
    expect(twiml.body).not.toContain("+19995550199");

    applyTransportStatus(ctx.db, session.id, "canceled");
    const finalized = await app.inject({
      method: "POST",
      url: `/api/calls/${session.id}/finalize`,
      headers: { cookie }
    });
    expect(finalized.statusCode).toBeGreaterThanOrEqual(400);
    expect(getProposalBySession(ctx.db, session.id)).toBeNull();

    await app.close();
  });
});
