import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { StoredProposalBody } from "./schema.js";

export type ProposalRow = {
  id: string;
  session_id: string | null;
  proposed_json: string;
  evidence_json: string;
  status: string;
  approved_json: string | null;
  sheet_write_attempts: number;
  last_error: string | null;
  created_at: string;
  approved_at: string | null;
  applied_at: string | null;
};

export type EvidenceJson = {
  utteranceIds: string[];
};

function nowIso(): string {
  return new Date().toISOString();
}

export function getProposal(db: Database.Database, id: string): ProposalRow | null {
  const row = db.prepare("SELECT * FROM post_call_proposals WHERE id = ?").get(id);
  return (row as ProposalRow | undefined) ?? null;
}

export function getProposalBySession(db: Database.Database, sessionId: string): ProposalRow | null {
  const row = db
    .prepare("SELECT * FROM post_call_proposals WHERE session_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(sessionId);
  return (row as ProposalRow | undefined) ?? null;
}

export function findPendingProposal(db: Database.Database): ProposalRow | null {
  const row = db
    .prepare(
      `SELECT * FROM post_call_proposals
       WHERE status IN ('pending_review', 'pending_retry', 'processing')
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .get();
  return (row as ProposalRow | undefined) ?? null;
}

export function insertProposal(
  db: Database.Database,
  input: {
    sessionId: string;
    body: StoredProposalBody;
    evidence: EvidenceJson;
    status: string;
  }
): ProposalRow {
  const id = randomUUID();
  const created = nowIso();
  db.prepare(
    `INSERT INTO post_call_proposals (
      id, session_id, proposed_json, evidence_json, status,
      sheet_write_attempts, last_error, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`
  ).run(id, input.sessionId, JSON.stringify(input.body), JSON.stringify(input.evidence), input.status, created);
  const row = getProposal(db, id);
  if (!row) {
    throw new Error("Failed to load created proposal");
  }
  return row;
}

export function updateProposalBody(
  db: Database.Database,
  id: string,
  body: StoredProposalBody,
  evidence: EvidenceJson,
  status: string
): ProposalRow | null {
  db.prepare(
    `UPDATE post_call_proposals
     SET proposed_json = ?, evidence_json = ?, status = ?, last_error = NULL
     WHERE id = ?`
  ).run(JSON.stringify(body), JSON.stringify(evidence), status, id);
  return getProposal(db, id);
}

export function markProposalRetry(db: Database.Database, id: string, error: string): void {
  db.prepare(
    `UPDATE post_call_proposals
     SET status = 'pending_retry', last_error = ?, sheet_write_attempts = sheet_write_attempts + 1
     WHERE id = ?`
  ).run(error, id);
}

export function markProposalApplied(
  db: Database.Database,
  id: string,
  approved: StoredProposalBody
): void {
  const now = nowIso();
  db.prepare(
    `UPDATE post_call_proposals
     SET status = 'applied', approved_json = ?, approved_at = ?, applied_at = ?,
         last_error = NULL, sheet_write_attempts = sheet_write_attempts + 1
     WHERE id = ?`
  ).run(JSON.stringify(approved), now, now, id);
}

export function markProposalDiscarded(db: Database.Database, id: string): void {
  db.prepare(
    `UPDATE post_call_proposals SET status = 'discarded', last_error = NULL WHERE id = ?`
  ).run(id);
}

export function parseBody(row: ProposalRow): StoredProposalBody {
  return JSON.parse(row.proposed_json) as StoredProposalBody;
}

export function parseEvidence(row: ProposalRow): EvidenceJson {
  try {
    return JSON.parse(row.evidence_json) as EvidenceJson;
  } catch {
    return { utteranceIds: [] };
  }
}
