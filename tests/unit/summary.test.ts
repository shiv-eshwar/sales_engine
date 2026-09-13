import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { migrate, openDatabase } from "../../src/server/db/index.js";
import { buildDailySummary } from "../../src/server/review/summary.js";

function freshDb() {
  const db = openDatabase(":memory:");
  migrate(db, "migrations");
  return db;
}

function insertSession(
  db: ReturnType<typeof openDatabase>,
  input: {
    campaignId: string;
    createdAt: string;
    connected?: boolean;
    transport?: string | null;
  }
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO call_sessions (
      id, lead_id, campaign_id, campaign_version, lead_snapshot_json, status, direction,
      connected_at, transport_outcome, created_at, updated_at
    ) VALUES (?, ?, ?, 1, '{}', 'completed', 'outbound', ?, ?, ?, ?)`
  ).run(
    id,
    `lead-${id}`,
    input.campaignId,
    input.connected ? input.createdAt : null,
    input.transport ?? null,
    input.createdAt,
    input.createdAt
  );
  return id;
}

function insertApplied(
  db: ReturnType<typeof openDatabase>,
  sessionId: string,
  qualification: string,
  semanticOutcome: string
): void {
  db.prepare(
    `INSERT INTO post_call_proposals (
      id, session_id, proposed_json, evidence_json, status, created_at
    ) VALUES (?, ?, ?, '{}', 'applied', datetime('now'))`
  ).run(
    randomUUID(),
    sessionId,
    JSON.stringify({
      outcome: { qualification, semanticOutcome }
    })
  );
}

describe("daily summary", () => {
  it("counts a UTC day and can filter by campaign", () => {
    const db = freshDb();
    try {
      const date = "2026-09-13";
      const morning = `${date}T10:00:00.000Z`;
      const otherDay = "2026-09-12T10:00:00.000Z";
      const alpha = insertSession(db, { campaignId: "alpha", createdAt: morning, connected: true });
      insertApplied(db, alpha, "qualified", "meeting_booked");
      insertSession(db, { campaignId: "beta", createdAt: morning, transport: "no-answer" });
      insertSession(db, { campaignId: "alpha", createdAt: otherDay, connected: true });

      const all = buildDailySummary(db, null, date);
      expect(all.attempts).toBe(2);
      expect(all.connects).toBe(1);
      expect(all.qualified).toBe(1);
      expect(all.meetings).toBe(1);
      expect(all.noAnswer).toBe(1);

      const alphaOnly = buildDailySummary(db, null, date, "alpha");
      expect(alphaOnly.attempts).toBe(1);
      expect(alphaOnly.connects).toBe(1);
      expect(alphaOnly.noAnswer).toBe(0);
      expect(alphaOnly.meetings).toBe(1);
    } finally {
      db.close();
    }
  });
});
