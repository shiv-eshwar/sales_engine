import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { PublicCalendarProposal, PublicCoachMessage } from "../../shared/contracts.js";
import { getCalendarProposal } from "../calendar/proposals.js";

export type CoachMessageRow = {
  id: string;
  session_id: string;
  role: "assistant" | "user" | "system";
  text: string;
  based_on_sequence: number | null;
  calendar_proposal_id: string | null;
  created_at: string;
};

export function insertCoachMessage(
  db: Database.Database,
  input: {
    sessionId: string;
    role: "assistant" | "user" | "system";
    text: string;
    basedOnSequence?: number | null;
    calendarProposalId?: string | null;
  }
): PublicCoachMessage {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO coach_messages (
      id, session_id, role, text, based_on_sequence, calendar_proposal_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.sessionId,
    input.role,
    input.text,
    input.basedOnSequence ?? null,
    input.calendarProposalId ?? null,
    createdAt
  );
  return toPublicCoachMessage(db, {
    id,
    session_id: input.sessionId,
    role: input.role,
    text: input.text,
    based_on_sequence: input.basedOnSequence ?? null,
    calendar_proposal_id: input.calendarProposalId ?? null,
    created_at: createdAt
  });
}

export function listCoachMessages(db: Database.Database, sessionId: string): PublicCoachMessage[] {
  const rows = db
    .prepare("SELECT * FROM coach_messages WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as CoachMessageRow[];
  return rows.map((row) => toPublicCoachMessage(db, row));
}

function toPublicCoachMessage(db: Database.Database, row: CoachMessageRow): PublicCoachMessage {
  let calendarProposal: PublicCalendarProposal | null = null;
  if (row.calendar_proposal_id) {
    calendarProposal = getCalendarProposal(db, row.calendar_proposal_id);
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    text: row.text,
    basedOnSequence: row.based_on_sequence,
    calendarProposal,
    createdAt: row.created_at
  };
}
