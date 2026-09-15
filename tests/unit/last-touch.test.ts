import { describe, expect, it } from "vitest";
import { applyTransportStatus, createCallSession } from "../../src/server/calls/ledger.js";
import { loadSheetsConfig } from "../../src/server/config/sheets.js";
import { migrate, openDatabase } from "../../src/server/db/index.js";
import { lastTouchForLeads } from "../../src/server/leads/lastTouch.js";
import { SheetAdapter } from "../../src/server/sheets/adapter.js";
import { EXAMPLE_HEADERS, exampleFixtureRows } from "../../src/server/sheets/fixture.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";
import {
  assembleLastTouch,
  callerLabel,
  formatLastTouchLine,
  lastTouchFingerprint,
  ordinal
} from "../../src/shared/lastTouch.js";

const sheet = {
  call_attempts: "",
  last_called_at: "",
  call_outcome: "",
  call_summary: "",
  objections: "",
  next_step: "",
  follow_up_at: ""
};

describe("last touch", () => {
  it("returns null when the lead has never been dialed", () => {
    expect(assembleLastTouch({ sheet, sessions: [] })).toBeNull();
  });

  it("uses Sheet attempts and last dial without inventing a conversation", () => {
    const touch = assembleLastTouch({
      sheet: {
        ...sheet,
        call_attempts: "2",
        last_called_at: "2026-09-10T15:00:00.000Z",
        call_outcome: "no-answer"
      },
      sessions: []
    });
    expect(touch?.dials).toBe(2);
    expect(touch?.conversations).toBe(0);
    expect(touch?.lastDialConnected).toBe(false);
    expect(touch?.lastSummary).toBeNull();
    expect(formatLastTouchLine(touch!)).toContain("2nd dial");
    expect(formatLastTouchLine(touch!)).toContain("no-answer");
  });

  it("splits last dial from last conversation and keeps who called", () => {
    const touch = assembleLastTouch({
      sheet: {
        ...sheet,
        call_attempts: "3",
        last_called_at: "2026-09-12T18:00:00.000Z",
        call_outcome: "no-answer",
        call_summary: "Asked to call after month-end close."
      },
      sessions: [
        {
          id: "s-talk",
          status: "completed",
          connectedAt: "2026-09-08T16:00:00.000Z",
          endedAt: "2026-09-08T16:12:00.000Z",
          createdAt: "2026-09-08T15:59:00.000Z",
          transportOutcome: "completed",
          operatorEmail: "aryan@example.com"
        },
        {
          id: "s-miss",
          status: "no-answer",
          connectedAt: null,
          endedAt: "2026-09-12T18:00:00.000Z",
          createdAt: "2026-09-12T17:59:00.000Z",
          transportOutcome: "no-answer",
          operatorEmail: "shiv@example.com"
        }
      ],
      proposalBySession: { "s-talk": "applied", "s-miss": "applied" }
    });
    expect(touch?.dials).toBe(3);
    expect(touch?.conversations).toBe(1);
    expect(touch?.lastDialer).toBe("shiv@example.com");
    expect(touch?.lastDialConnected).toBe(false);
    expect(touch?.lastConversationBy).toBe("aryan@example.com");
    expect(touch?.lastSummary).toBe("Asked to call after month-end close.");
    expect(formatLastTouchLine(touch!)).toContain("shiv");
    expect(formatLastTouchLine(touch!)).toContain("no-answer");
    expect(formatLastTouchLine(touch!)).not.toContain("Wait");
  });

  it("marks an unwritten dial and treats a future follow-up as a brake", () => {
    const unwritten = assembleLastTouch({
      sheet,
      sessions: [
        {
          id: "s-1",
          status: "completed",
          connectedAt: "2026-09-15T10:00:00.000Z",
          endedAt: "2026-09-15T10:08:00.000Z",
          createdAt: "2026-09-15T09:59:00.000Z",
          transportOutcome: "completed",
          operatorEmail: "aryan@example.com"
        }
      ],
      proposalBySession: { "s-1": "discarded" }
    });
    expect(unwritten?.unwritten).toBe(true);
    expect(formatLastTouchLine(unwritten!)).toContain("not written");

    const waiting = assembleLastTouch({
      sheet: { ...sheet, follow_up_at: "2026-10-01T00:00:00.000Z", call_attempts: "1" },
      sessions: [],
      nowMs: Date.parse("2026-09-15T00:00:00.000Z")
    });
    expect(waiting?.followUpPending).toBe(true);
    expect(formatLastTouchLine(waiting!)).toContain("Wait");
  });

  it("changes the prep fingerprint when last touch or caller identity changes", () => {
    const base = assembleLastTouch({
      sheet: { ...sheet, call_attempts: "1", last_called_at: "2026-09-10T15:00:00.000Z", call_outcome: "no-answer" },
      sessions: []
    });
    const next = assembleLastTouch({
      sheet: { ...sheet, call_attempts: "2", last_called_at: "2026-09-12T15:00:00.000Z", call_outcome: "no-answer" },
      sessions: []
    });
    expect(lastTouchFingerprint(base)).not.toBe(lastTouchFingerprint(next));
    expect(callerLabel("aryan@example.com")).toBe("aryan");
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(13)).toBe("13th");
  });

  it("reads Sheet history and stamps who last dialed from the ledger", async () => {
    const db = openDatabase(":memory:");
    migrate(db, "migrations");
    const config = loadSheetsConfig("config/sheets.example.yaml");
    const adapter = new SheetAdapter(new MemorySheetStore(EXAMPLE_HEADERS, exampleFixtureRows()), config, ["US"]);
    const queue = await adapter.loadQueue();
    const jordan = queue.leads.find((lead) => lead.leadId === "L-101")!;
    const alex = queue.leads.find((lead) => lead.leadId === "L-100")!;
    const before = lastTouchForLeads(db, config, [jordan, alex]);
    expect(before.get("L-100")).toBeUndefined();
    expect(before.get("L-101")?.dials).toBe(2);
    expect(before.get("L-101")?.conversations).toBe(0);
    expect(formatLastTouchLine(before.get("L-101")!)).toContain("2nd dial");

    const session = createCallSession(db, {
      leadId: "L-100",
      campaignId: "sales",
      campaignVersion: 1,
      snapshot: {
        leadId: "L-100",
        fullName: alex.fullName,
        phone: alex.phone,
        phoneE164: alex.phoneE164 ?? alex.phone,
        company: alex.company,
        role: alex.role
      },
      operator: { id: "user-1", email: "shiv@example.com" }
    });
    applyTransportStatus(db, session.id, "no-answer");
    const after = lastTouchForLeads(db, config, [alex]);
    expect(after.get("L-100")?.dials).toBe(1);
    expect(after.get("L-100")?.lastDialer).toBe("shiv@example.com");
    expect(after.get("L-100")?.unwritten).toBe(true);
    expect(formatLastTouchLine(after.get("L-100")!)).toContain("shiv");
    db.close();
  });
});
