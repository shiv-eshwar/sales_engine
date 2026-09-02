import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export function storePendingRetry(
  db: Database.Database,
  proposed: unknown,
  error: string
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO post_call_proposals (
      id, session_id, proposed_json, evidence_json, status,
      sheet_write_attempts, last_error, created_at
    ) VALUES (?, NULL, ?, ?, 'pending_retry', 1, ?, ?)`
  ).run(id, JSON.stringify(proposed), JSON.stringify({}), error, new Date().toISOString());
  return id;
}
