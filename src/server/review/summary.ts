import type { PlaybookConfig } from "../../shared/schemas.js";
import type { DailySummary } from "../../shared/contracts.js";
import type Database from "better-sqlite3";
import { computeTalkRatio } from "../coach/talkRatio.js";
import { listUtterances } from "../transcript/utterances.js";
import { parseBody } from "./store.js";

export function dayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function buildDailySummary(
  db: Database.Database,
  playbook: PlaybookConfig | null,
  date = dayStamp(),
  campaignId?: string | null
): DailySummary {
  const campaignClause = campaignId ? "AND s.campaign_id = ?" : "";
  const params = campaignId ? [date, campaignId] : [date];

  const sessions = db
    .prepare(
      `SELECT s.id, s.status, s.transport_outcome, s.connected_at, s.started_at, s.created_at
       FROM call_sessions s
       WHERE substr(s.created_at, 1, 10) = ? ${campaignClause}`
    )
    .all(...params) as Array<{
    id: string;
    status: string;
    transport_outcome: string | null;
    connected_at: string | null;
    started_at: string | null;
    created_at: string;
  }>;

  const proposals = db
    .prepare(
      `SELECT p.proposed_json, p.approved_json, p.status
       FROM post_call_proposals p
       JOIN call_sessions s ON s.id = p.session_id
       WHERE substr(s.created_at, 1, 10) = ? ${campaignClause} AND p.status = 'applied'`
    )
    .all(...params) as Array<{ proposed_json: string; approved_json: string | null; status: string }>;

  let qualified = 0;
  let disqualified = 0;
  let unknown = 0;
  let meetings = 0;
  let followUps = 0;
  let references = 0;
  let callbacks = 0;

  for (const row of proposals) {
    const body = parseBody({
      id: "",
      session_id: null,
      proposed_json: row.approved_json ?? row.proposed_json,
      evidence_json: "{}",
      status: row.status,
      approved_json: row.approved_json,
      sheet_write_attempts: 0,
      last_error: null,
      created_at: "",
      approved_at: null,
      applied_at: null
    });
    const qualification = body.outcome.qualification;
    if (qualification === "qualified") {
      qualified += 1;
    } else if (qualification === "disqualified") {
      disqualified += 1;
    } else {
      unknown += 1;
    }
    switch (body.outcome.semanticOutcome) {
      case "meeting_booked":
        meetings += 1;
        break;
      case "permission_to_follow_up":
        followUps += 1;
        break;
      case "reference_received":
        references += 1;
        break;
      case "callback_later":
        callbacks += 1;
        break;
      default:
        break;
    }
  }

  const connects = sessions.filter((row) => Boolean(row.connected_at)).length;
  const noAnswer = sessions.filter((row) => row.transport_outcome === "no-answer").length;
  const busy = sessions.filter((row) => row.transport_outcome === "busy").length;
  const failed = sessions.filter((row) => row.transport_outcome === "failed").length;

  const ratios: number[] = [];
  for (const session of sessions) {
    if (!session.connected_at) {
      continue;
    }
    const utterances = listUtterances(db, session.id);
    const talk = computeTalkRatio(utterances, session.connected_at, playbook);
    if (talk.callerMs + talk.contactMs > 0) {
      ratios.push(talk.callerShare);
    }
  }
  const averageTalkRatio =
    ratios.length === 0 ? null : ratios.reduce((sum, value) => sum + value, 0) / ratios.length;

  const observation = db
    .prepare(
      `SELECT e.cue, e.reason FROM coaching_events e
       JOIN call_sessions s ON s.id = e.session_id
       WHERE e.shown_at IS NOT NULL AND e.cue IS NOT NULL
         AND substr(s.created_at, 1, 10) = ? ${campaignClause}
       ORDER BY e.created_at DESC LIMIT 1`
    )
    .get(...params) as { cue: string; reason: string | null } | undefined;

  return {
    date,
    attempts: sessions.length,
    connects,
    qualified,
    disqualified,
    unknown,
    meetings,
    followUps,
    references,
    callbacks,
    noAnswer,
    busy,
    failed,
    averageTalkRatio,
    coachingObservation: observation ? `${observation.cue}${observation.reason ? ` (${observation.reason})` : ""}` : null
  };
}
