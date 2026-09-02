import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  ACTIVE_CALL_STATUSES,
  applyStatusTransition,
  isTerminalStatus,
  type CallStatus
} from "./state.js";

export type CallSessionRow = {
  id: string;
  lead_id: string;
  campaign_id: string;
  campaign_version: number;
  lead_snapshot_json: string;
  status: CallStatus;
  twilio_parent_sid: string | null;
  twilio_child_sid: string | null;
  recording_sid: string | null;
  started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  transport_outcome: string | null;
  transcript_complete: number | null;
  created_at: string;
  updated_at: string;
};

export type LeadSnapshot = {
  leadId: string;
  fullName: string;
  phone: string;
  phoneE164: string;
  company: string;
  role: string;
};

export class ActiveCallExistsError extends Error {
  readonly sessionId: string;
  constructor(sessionId: string) {
    super("An active call already exists");
    this.name = "ActiveCallExistsError";
    this.sessionId = sessionId;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function asRow(row: unknown): CallSessionRow {
  return row as CallSessionRow;
}

export function findActiveSession(db: Database.Database): CallSessionRow | null {
  const placeholders = ACTIVE_CALL_STATUSES.map(() => "?").join(", ");
  const row = db
    .prepare(`SELECT * FROM call_sessions WHERE status IN (${placeholders}) ORDER BY created_at ASC LIMIT 1`)
    .get(...ACTIVE_CALL_STATUSES);
  return row ? asRow(row) : null;
}

export function getSession(db: Database.Database, id: string): CallSessionRow | null {
  const row = db.prepare("SELECT * FROM call_sessions WHERE id = ?").get(id);
  return row ? asRow(row) : null;
}

export function findSessionByParentSid(db: Database.Database, sid: string): CallSessionRow | null {
  const row = db.prepare("SELECT * FROM call_sessions WHERE twilio_parent_sid = ?").get(sid);
  return row ? asRow(row) : null;
}

export function findSessionByChildSid(db: Database.Database, sid: string): CallSessionRow | null {
  const row = db.prepare("SELECT * FROM call_sessions WHERE twilio_child_sid = ?").get(sid);
  return row ? asRow(row) : null;
}

export function createCallSession(
  db: Database.Database,
  input: {
    leadId: string;
    campaignId: string;
    campaignVersion: number;
    snapshot: LeadSnapshot;
  }
): CallSessionRow {
  const existing = findActiveSession(db);
  if (existing) {
    throw new ActiveCallExistsError(existing.id);
  }
  const id = randomUUID();
  const created = nowIso();
  db.prepare(
    `INSERT INTO call_sessions (
      id, lead_id, campaign_id, campaign_version, lead_snapshot_json, status,
      started_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'created', ?, ?, ?)`
  ).run(id, input.leadId, input.campaignId, input.campaignVersion, JSON.stringify(input.snapshot), created, created, created);
  const row = getSession(db, id);
  if (!row) {
    throw new Error("Failed to load created call session");
  }
  return row;
}

export function attachParentSid(db: Database.Database, sessionId: string, sid: string): CallSessionRow | null {
  const session = getSession(db, sessionId);
  if (!session) {
    return null;
  }
  if (session.twilio_parent_sid && session.twilio_parent_sid !== sid) {
    return session;
  }
  if (!session.twilio_parent_sid) {
    db.prepare("UPDATE call_sessions SET twilio_parent_sid = ?, updated_at = ? WHERE id = ?").run(
      sid,
      nowIso(),
      sessionId
    );
  }
  return getSession(db, sessionId);
}

export function attachChildSid(db: Database.Database, sessionId: string, sid: string): CallSessionRow | null {
  const session = getSession(db, sessionId);
  if (!session) {
    return null;
  }
  if (session.twilio_child_sid && session.twilio_child_sid !== sid) {
    return session;
  }
  if (!session.twilio_child_sid) {
    db.prepare("UPDATE call_sessions SET twilio_child_sid = ?, updated_at = ? WHERE id = ?").run(
      sid,
      nowIso(),
      sessionId
    );
  }
  return getSession(db, sessionId);
}

export function applyTransportStatus(
  db: Database.Database,
  sessionId: string,
  next: CallStatus
): CallSessionRow | null {
  const session = getSession(db, sessionId);
  if (!session) {
    return null;
  }
  const result = applyStatusTransition(session.status, next);
  if (!result.ok || !result.changed) {
    return getSession(db, sessionId);
  }
  const updated = nowIso();
  const connectedAt =
    result.status === "in_progress" && !session.connected_at ? updated : session.connected_at;
  const endedAt = isTerminalStatus(result.status) ? updated : session.ended_at;
  const transportOutcome = isTerminalStatus(result.status) ? result.status : session.transport_outcome;
  db.prepare(
    `UPDATE call_sessions
     SET status = ?, connected_at = ?, ended_at = ?, transport_outcome = ?, updated_at = ?
     WHERE id = ?`
  ).run(result.status, connectedAt, endedAt, transportOutcome, updated, sessionId);
  return getSession(db, sessionId);
}

export function webhookIdempotencyKey(callSid: string, eventType: string): string {
  return `${callSid}:${eventType}`;
}

export function hashPayload(params: Record<string, string>): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha256").update(canonical).digest("hex");
}

export function recordWebhookOnce(
  db: Database.Database,
  input: {
    idempotencyKey: string;
    provider: string;
    eventType: string;
    payloadHash: string;
    result: string;
  }
): boolean {
  const existing = db
    .prepare("SELECT idempotency_key FROM webhook_events WHERE idempotency_key = ?")
    .get(input.idempotencyKey);
  if (existing) {
    return false;
  }
  db.prepare(
    `INSERT INTO webhook_events (
      idempotency_key, provider, event_type, payload_hash, processed_at, result
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.idempotencyKey,
    input.provider,
    input.eventType,
    input.payloadHash,
    nowIso(),
    input.result
  );
  return true;
}

export function publicCallSession(row: CallSessionRow) {
  const snapshot = JSON.parse(row.lead_snapshot_json) as LeadSnapshot;
  return {
    id: row.id,
    leadId: row.lead_id,
    campaignId: row.campaign_id,
    status: row.status,
    transportOutcome: row.transport_outcome,
    phoneE164: snapshot.phoneE164,
    contactName: snapshot.fullName,
    startedAt: row.started_at,
    connectedAt: row.connected_at,
    endedAt: row.ended_at
  };
}
