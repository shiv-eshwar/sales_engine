import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export const GAP_TEXT = "[gap]";

export type Speaker = "caller" | "contact";
export type TranscriptionHealth = "ok" | "interrupted" | "unavailable";

export type PublicUtterance = {
  id: string;
  sessionId: string;
  speaker: Speaker;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  confidence: number | null;
  isFinal: true;
  sequence: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function nextSequence(db: Database.Database, sessionId: string): number {
  const row = db
    .prepare("SELECT MAX(sequence) AS max FROM transcript_utterances WHERE session_id = ?")
    .get(sessionId) as { max: number | null };
  return (row.max ?? 0) + 1;
}

function asSpeaker(value: string): Speaker {
  return value === "contact" ? "contact" : "caller";
}

export function insertUtterance(
  db: Database.Database,
  input: {
    sessionId: string;
    speaker: Speaker;
    text: string;
    startMs: number;
    endMs: number;
    confidence: number | null;
  }
): PublicUtterance {
  const id = randomUUID();
  const sequence = nextSequence(db, input.sessionId);
  const created = nowIso();
  db.prepare(
    `INSERT INTO transcript_utterances (
      id, session_id, speaker, text, start_ms, end_ms, confidence, sequence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.sessionId,
    input.speaker,
    input.text,
    input.startMs,
    input.endMs,
    input.confidence,
    sequence,
    created
  );
  return {
    id,
    sessionId: input.sessionId,
    speaker: input.speaker,
    text: input.text,
    startedAtMs: input.startMs,
    endedAtMs: input.endMs,
    confidence: input.confidence,
    isFinal: true,
    sequence
  };
}

export function insertGap(
  db: Database.Database,
  input: { sessionId: string; speaker: Speaker; startMs: number; endMs: number }
): PublicUtterance {
  return insertUtterance(db, {
    sessionId: input.sessionId,
    speaker: input.speaker,
    text: GAP_TEXT,
    startMs: input.startMs,
    endMs: input.endMs,
    confidence: null
  });
}

export function listUtterances(db: Database.Database, sessionId: string): PublicUtterance[] {
  const rows = db
    .prepare(
      `SELECT id, session_id, speaker, text, start_ms, end_ms, confidence, sequence
       FROM transcript_utterances
       WHERE session_id = ?
       ORDER BY sequence ASC`
    )
    .all(sessionId) as Array<{
    id: string;
    session_id: string;
    speaker: string;
    text: string;
    start_ms: number;
    end_ms: number;
    confidence: number | null;
    sequence: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    speaker: asSpeaker(row.speaker),
    text: row.text,
    startedAtMs: row.start_ms,
    endedAtMs: row.end_ms,
    confidence: row.confidence,
    isFinal: true as const,
    sequence: row.sequence
  }));
}

export function sessionHasGaps(db: Database.Database, sessionId: string): boolean {
  const row = db
    .prepare("SELECT 1 AS found FROM transcript_utterances WHERE session_id = ? AND text = ? LIMIT 1")
    .get(sessionId, GAP_TEXT) as { found: number } | undefined;
  return Boolean(row);
}

export function setTranscriptComplete(db: Database.Database, sessionId: string, complete: boolean): void {
  db.prepare("UPDATE call_sessions SET transcript_complete = ?, updated_at = ? WHERE id = ?").run(
    complete ? 1 : 0,
    nowIso(),
    sessionId
  );
}
