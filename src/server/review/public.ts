import type { CampaignConfig, SheetsConfig } from "../../shared/schemas.js";
import type { PublicProposal } from "../../shared/contracts.js";
import type { LeadSnapshot } from "../calls/ledger.js";
import { getSession } from "../calls/ledger.js";
import { listCoachingEvents } from "../coach/store.js";
import { listUtterances } from "../transcript/utterances.js";
import { fieldDiff } from "./fields.js";
import { parseBody, type ProposalRow } from "./store.js";
import type Database from "better-sqlite3";

export function toPublicProposal(
  db: Database.Database,
  row: ProposalRow,
  input: {
    sheets: SheetsConfig;
    campaigns: CampaignConfig[];
    currentFields?: Record<string, string>;
  }
): PublicProposal {
  const body = parseBody(row);
  const session = row.session_id ? getSession(db, row.session_id) : null;
  const snapshot = session ? (JSON.parse(session.lead_snapshot_json) as LeadSnapshot) : null;
  const campaign = input.campaigns.find((item) => item.id === body.campaignId);
  const current = input.currentFields ?? body.currentFields;
  const proposed = body.fields;
  const utterances = row.session_id ? listUtterances(db, row.session_id) : [];
  const coaching = row.session_id ? listCoachingEvents(db, row.session_id) : [];

  const criteria = Object.entries(campaign?.qualification.criteria ?? {}).map(([id, spec]) => ({
    id,
    prompt: spec.prompt,
    state: (body.outcome.criteria[id]?.state ?? "unknown") as "yes" | "no" | "unknown",
    evidence: body.outcome.criteria[id]?.evidence ?? null,
    confidence: body.outcome.criteria[id]?.confidence ?? 0
  }));

  return {
    id: row.id,
    sessionId: row.session_id ?? "",
    status: row.status as PublicProposal["status"],
    kind: body.kind,
    leadId: body.leadId,
    campaignId: body.campaignId,
    contactName: body.contactName || snapshot?.fullName || "",
    transportOutcome: body.transportOutcome,
    semanticOutcome: body.outcome.semanticOutcome,
    qualification: body.outcome.qualification,
    qualificationReason: body.outcome.qualificationReason,
    criteria,
    painOrResearchFindings: body.outcome.painOrResearchFindings,
    objections: body.outcome.objections,
    nextStep: body.outcome.nextStep,
    followUpAt: body.outcome.followUpAt,
    summary: body.outcome.summary,
    callerCommitments: body.outcome.callerCommitments,
    contactCommitments: body.outcome.contactCommitments,
    transcriptComplete: session
      ? session.transcript_complete === null
        ? null
        : Boolean(session.transcript_complete)
      : body.outcome.transcriptComplete,
    confidence: body.outcome.confidence,
    warnings: body.warnings,
    proposedFields: proposed,
    diff: fieldDiff(input.sheets, current, proposed),
    lastError: row.last_error,
    utterances,
    coachingReplay: coaching.map((event) => ({
      stage: event.stage,
      cueType: event.cue_type,
      cue: event.cue,
      reason: event.reason
    }))
  };
}
