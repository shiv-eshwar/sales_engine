import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { PublicCalendarProposal } from "../../shared/contracts.js";
import type { CalendarProposalSource, CalendarProposalStatus } from "./types.js";

export type CalendarProposalDraft = {
  title: string;
  start: string;
  end: string;
  timezone: string;
  attendees: string[];
  meet: boolean;
  notes: string;
};

export type CalendarProposalRow = {
  id: string;
  session_id: string | null;
  source: CalendarProposalSource;
  status: CalendarProposalStatus;
  title: string;
  start_iso: string;
  end_iso: string;
  timezone: string;
  attendees_json: string;
  meet: number;
  notes: string | null;
  google_event_id: string | null;
  html_link: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

function asRow(row: unknown): CalendarProposalRow {
  return row as CalendarProposalRow;
}

export function toPublicCalendarProposal(row: CalendarProposalRow): PublicCalendarProposal {
  let attendees: string[] = [];
  try {
    attendees = JSON.parse(row.attendees_json) as string[];
  } catch {
    attendees = [];
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    source: row.source,
    status: row.status,
    title: row.title,
    start: row.start_iso,
    end: row.end_iso,
    timezone: row.timezone,
    attendees,
    meet: Boolean(row.meet),
    notes: row.notes ?? "",
    htmlLink: row.html_link,
    lastError: row.last_error
  };
}

export function insertCalendarProposal(
  db: Database.Database,
  input: {
    sessionId: string | null;
    source: CalendarProposalSource;
    draft: CalendarProposalDraft;
  }
): PublicCalendarProposal {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO calendar_proposals (
      id, session_id, source, status, title, start_iso, end_iso, timezone, attendees_json,
      meet, notes, google_event_id, html_link, last_error, created_at, updated_at, sent_at
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, NULL)`
  ).run(
    id,
    input.sessionId,
    input.source,
    input.draft.title,
    input.draft.start,
    input.draft.end,
    input.draft.timezone,
    JSON.stringify(input.draft.attendees),
    input.draft.meet ? 1 : 0,
    input.draft.notes || null,
    now,
    now
  );
  return getCalendarProposal(db, id)!;
}

export function getCalendarProposal(db: Database.Database, id: string): PublicCalendarProposal | null {
  const row = db.prepare("SELECT * FROM calendar_proposals WHERE id = ?").get(id);
  return row ? toPublicCalendarProposal(asRow(row)) : null;
}

export function listCalendarProposals(db: Database.Database, sessionId: string): PublicCalendarProposal[] {
  const rows = db
    .prepare("SELECT * FROM calendar_proposals WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as CalendarProposalRow[];
  return rows.map((row) => toPublicCalendarProposal(row));
}

export function updateCalendarProposalDraft(
  db: Database.Database,
  id: string,
  draft: Partial<CalendarProposalDraft>
): PublicCalendarProposal | null {
  const current = getCalendarProposal(db, id);
  if (!current) return null;
  const next: CalendarProposalDraft = {
    title: draft.title ?? current.title,
    start: draft.start ?? current.start,
    end: draft.end ?? current.end,
    timezone: draft.timezone ?? current.timezone,
    attendees: draft.attendees ?? current.attendees,
    meet: draft.meet ?? current.meet,
    notes: draft.notes ?? current.notes
  };
  db.prepare(
    `UPDATE calendar_proposals SET
      title = ?, start_iso = ?, end_iso = ?, timezone = ?, attendees_json = ?, meet = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    next.title,
    next.start,
    next.end,
    next.timezone,
    JSON.stringify(next.attendees),
    next.meet ? 1 : 0,
    next.notes || null,
    new Date().toISOString(),
    id
  );
  return getCalendarProposal(db, id);
}

export function markCalendarProposalSent(
  db: Database.Database,
  id: string,
  event: { id: string; htmlLink: string }
): PublicCalendarProposal | null {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE calendar_proposals SET
      status = 'sent', google_event_id = ?, html_link = ?, last_error = NULL, sent_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(event.id, event.htmlLink, now, now, id);
  return getCalendarProposal(db, id);
}

export function markCalendarProposalFailed(db: Database.Database, id: string, error: string): PublicCalendarProposal | null {
  db.prepare(
    `UPDATE calendar_proposals SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`
  ).run(error, new Date().toISOString(), id);
  return getCalendarProposal(db, id);
}

export function markCalendarProposalDismissed(db: Database.Database, id: string): PublicCalendarProposal | null {
  db.prepare(
    `UPDATE calendar_proposals SET status = 'dismissed', updated_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), id);
  return getCalendarProposal(db, id);
}
