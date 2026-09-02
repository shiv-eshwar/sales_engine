import { describe, expect, it } from "vitest";
import { applyStatusTransition, parseTwilioCallStatus } from "../../src/server/calls/state.js";
import { ActiveCallExistsError, createCallSession, findActiveSession } from "../../src/server/calls/ledger.js";
import { migrate, openDatabase } from "../../src/server/db/index.js";

describe("call status machine", () => {
  it("maps Twilio statuses including answered and no-answer", () => {
    expect(parseTwilioCallStatus("queued")).toBe("queued");
    expect(parseTwilioCallStatus("ringing")).toBe("ringing");
    expect(parseTwilioCallStatus("answered")).toBe("in_progress");
    expect(parseTwilioCallStatus("in-progress")).toBe("in_progress");
    expect(parseTwilioCallStatus("no-answer")).toBe("no-answer");
    expect(parseTwilioCallStatus("cancelled")).toBe("canceled");
  });

  it("rejects illegal regressions and keeps the first terminal state", () => {
    expect(applyStatusTransition("created", "ringing")).toEqual({ ok: true, status: "ringing", changed: true });
    expect(applyStatusTransition("in_progress", "queued")).toEqual({
      ok: false,
      reason: "stale",
      status: "in_progress"
    });
    expect(applyStatusTransition("completed", "in_progress")).toEqual({
      ok: false,
      reason: "stale",
      status: "completed"
    });
    expect(applyStatusTransition("busy", "completed")).toEqual({ ok: false, reason: "stale", status: "busy" });
  });

  it("rejects a second active session", () => {
    const db = openDatabase(":memory:");
    migrate(db, "migrations");
    const snapshot = {
      leadId: "L-100",
      fullName: "Alex",
      phone: "+14155550100",
      phoneE164: "+14155550100",
      company: "Co",
      role: "Eng"
    };
    createCallSession(db, { leadId: "L-100", campaignId: "sales", campaignVersion: 1, snapshot });
    expect(findActiveSession(db)?.lead_id).toBe("L-100");
    expect(() =>
      createCallSession(db, { leadId: "L-101", campaignId: "sales", campaignVersion: 1, snapshot })
    ).toThrow(ActiveCallExistsError);
    db.close();
  });
});
