import type Database from "better-sqlite3";
import type { PublicLastTouch } from "../../shared/contracts.js";
import { assembleLastTouch, type LastTouchSession } from "../../shared/lastTouch.js";
import type { SheetsConfig } from "../../shared/schemas.js";
import type { LeadRecord } from "../../shared/types.js";
import type { CallSessionRow } from "../calls/ledger.js";
import { currentWriteFields } from "../review/fields.js";

function asSession(row: CallSessionRow): LastTouchSession {
  return {
    id: row.id,
    status: row.status,
    connectedAt: row.connected_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    transportOutcome: row.transport_outcome,
    operatorEmail: row.operator_email
  };
}

export function listOutboundSessionsForLeads(db: Database.Database, leadIds: string[]): CallSessionRow[] {
  if (leadIds.length === 0) return [];
  const placeholders = leadIds.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT * FROM call_sessions
       WHERE lead_id IN (${placeholders}) AND direction = 'outbound'
       ORDER BY created_at ASC`
    )
    .all(...leadIds) as CallSessionRow[];
}

export function proposalStatusBySession(db: Database.Database, sessionIds: string[]): Record<string, string> {
  if (sessionIds.length === 0) return {};
  const placeholders = sessionIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT session_id, status FROM post_call_proposals
       WHERE session_id IN (${placeholders})`
    )
    .all(...sessionIds) as Array<{ session_id: string | null; status: string }>;
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (!row.session_id) continue;
    result[row.session_id] = row.status;
  }
  return result;
}

export function lastTouchForLeads(
  db: Database.Database,
  config: SheetsConfig | null,
  records: LeadRecord[]
): Map<string, PublicLastTouch> {
  const result = new Map<string, PublicLastTouch>();
  if (records.length === 0) return result;
  const sessions = listOutboundSessionsForLeads(db, records.map((lead) => lead.leadId));
  const proposalBySession = proposalStatusBySession(db, sessions.map((row) => row.id));
  const byLead = new Map<string, LastTouchSession[]>();
  for (const row of sessions) {
    const list = byLead.get(row.lead_id) ?? [];
    list.push(asSession(row));
    byLead.set(row.lead_id, list);
  }
  const emptySheet = {
    call_attempts: "",
    last_called_at: "",
    call_outcome: "",
    call_summary: "",
    objections: "",
    next_step: "",
    follow_up_at: ""
  };
  for (const lead of records) {
    const sheet = config ? currentWriteFields(config, lead.cells) : emptySheet;
    const touch = assembleLastTouch({
      sheet: {
        call_attempts: sheet.call_attempts,
        last_called_at: sheet.last_called_at,
        call_outcome: sheet.call_outcome,
        call_summary: sheet.call_summary,
        objections: sheet.objections,
        next_step: sheet.next_step,
        follow_up_at: sheet.follow_up_at
      },
      sessions: byLead.get(lead.leadId) ?? [],
      proposalBySession
    });
    if (touch) result.set(lead.leadId, touch);
  }
  return result;
}
