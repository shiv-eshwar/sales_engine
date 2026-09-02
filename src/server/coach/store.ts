import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { LiveCoachOutput } from "./schema.js";

export type CoachingEventRow = {
  id: string;
  session_id: string;
  based_on_sequence: number;
  stage: string;
  cue_type: string;
  cue: string | null;
  reason: string | null;
  output_json: string;
  shown_at: string | null;
  created_at: string;
};

export function insertCoachingEvent(
  db: Database.Database,
  input: {
    sessionId: string;
    output: LiveCoachOutput;
    shown: boolean;
  }
): void {
  db.prepare(
    `INSERT INTO coaching_events (
      id, session_id, based_on_sequence, stage, cue_type, cue, reason, output_json, shown_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    input.sessionId,
    input.output.basedOnSequence,
    input.output.stage,
    input.output.cueType,
    input.output.shouldShow ? input.output.cue : null,
    input.output.reason,
    JSON.stringify(input.output),
    input.shown ? new Date().toISOString() : null,
    new Date().toISOString()
  );
}

export function listCoachingEvents(db: Database.Database, sessionId: string): CoachingEventRow[] {
  return db
    .prepare("SELECT * FROM coaching_events WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as CoachingEventRow[];
}
