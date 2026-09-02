import { describe, expect, it } from "vitest";
import { callDisabledReason } from "../../src/client/state/calls.js";
import type { PublicLead } from "../../src/shared/contracts.js";

const lead: PublicLead = {
  leadId: "L-100",
  fullName: "Alex",
  phone: "+14155550100",
  phoneE164: "+14155550100",
  dialable: true,
  company: "Co",
  role: "Eng",
  enrichment: "",
  campaignId: "sales",
  crmStatus: "Ready",
  callStatus: "",
  issues: []
};

describe("call button gate", () => {
  it("hides Call when the Sheet schema is invalid", () => {
    const reason = callDisabledReason({
      twilioConfigured: true,
      deviceStatus: "registered",
      lead,
      callActive: false,
      sheetStatus: "error"
    });
    expect(reason).toMatch(/schema is invalid/i);
  });

  it("disables Call when the lead is not dialable", () => {
    const reason = callDisabledReason({
      twilioConfigured: true,
      deviceStatus: "registered",
      lead: { ...lead, dialable: false, phoneE164: null },
      callActive: false
    });
    expect(reason).toMatch(/not dialable/i);
  });

  it("allows Call when Twilio is registered and the lead is dialable", () => {
    expect(
      callDisabledReason({
        twilioConfigured: true,
        deviceStatus: "registered",
        lead,
        callActive: false
      })
    ).toBeNull();
  });
});
