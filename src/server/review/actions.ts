import type { AppContext } from "../context.js";
import type { BootstrapResponse, PublicLead, PublicProposal } from "../../shared/contracts.js";
import type { WriteFields } from "../../shared/types.js";
import { loadNextLead } from "../leads/nextLead.js";
import { DNC_CALL_STATUS, SKIPPED_CALL_STATUS, applyFieldEdits, writeFieldsFromProposed } from "./fields.js";
import {
  getProposal,
  markProposalApplied,
  markProposalDiscarded,
  markProposalRetry,
  parseBody,
  parseEvidence,
  updateProposalBody
} from "./store.js";
import { getProposalOrThrow } from "./finalize.js";
import { getSession } from "../calls/ledger.js";
import { activateCampaignSheet } from "../sheets/bind.js";

export class ReviewError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly http = 400
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

export async function approveProposal(
  ctx: AppContext,
  proposalId: string,
  edits: WriteFields | undefined
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; leads: PublicLead[]; sheet: BootstrapResponse["sheet"] }> {
  const row = getProposalOrThrow(ctx.db, proposalId);
  if (row.session_id) {
    const session = getSession(ctx.db, row.session_id);
    if (session) await activateCampaignSheet(ctx, session.campaign_id);
  }
  if (!ctx.adapter || !ctx.sheetsConfig || !ctx.finalizer) {
    throw new ReviewError("unconfigured", "Sheet is not configured", 503);
  }
  if (row.status !== "pending_review" && row.status !== "pending_retry") {
    throw new ReviewError("state", `Proposal cannot be approved in status ${row.status}`);
  }
  const body = parseBody(row);
  const evidence = parseEvidence(row);
  const fields = applyFieldEdits(body.fields, edits);
  if (fields.call_outcome === "do_not_contact") {
    fields.call_status = DNC_CALL_STATUS;
    body.outcome = { ...body.outcome, semanticOutcome: "do_not_contact" };
  }
  body.fields = fields;
  // Persist operator edits before touching the Sheet so a transient write
  // failure (pending_retry) does not silently drop them on retry-write.
  updateProposalBody(ctx.db, row.id, body, evidence, row.status);
  const write = writeFieldsFromProposed(fields, body.currentFields);
  const result = await ctx.adapter.applyApprovedWrite({
    leadId: body.leadId,
    snapshotPhone: body.snapshotPhone,
    fields: write,
    proposalId: row.id
  });
  if (!result.ok) {
    if (result.code === "identity_conflict") {
      throw new ReviewError("identity_conflict", result.message, 409);
    }
    markProposalRetry(ctx.db, row.id, result.message);
    const failed = getProposal(ctx.db, row.id);
    const next = await loadNextLead(ctx);
    return {
      proposal: ctx.finalizer.present(failed ?? row),
      lead: next.lead,
      leads: next.leads,
      sheet: next.sheetStatus
    };
  }
  markProposalApplied(ctx.db, row.id, body);
  const applied = getProposalOrThrow(ctx.db, row.id);
  const next = await loadNextLead(ctx);
  return {
    proposal: ctx.finalizer.present(applied),
    lead: next.lead,
    leads: next.leads,
    sheet: next.sheetStatus
  };
}

export async function skipNonConnect(ctx: AppContext, proposalId: string) {
  return approveProposal(ctx, proposalId, { call_status: SKIPPED_CALL_STATUS });
}

const CONNECTED_EDIT_KEYS = [
  "call_status",
  "call_outcome",
  "qualification",
  "qualification_reason",
  "objections",
  "next_step",
  "follow_up_at",
  "call_summary"
] as const;

const NON_CONNECT_EDIT_KEYS = ["call_status", "call_outcome"] as const;

function operatorEdits(kind: string, edits: WriteFields | undefined): WriteFields {
  const allowed = kind === "non_connect" ? NON_CONNECT_EDIT_KEYS : CONNECTED_EDIT_KEYS;
  const next: WriteFields = {};
  if (!edits) return next;
  for (const key of allowed) {
    const value = edits[key];
    if (value !== undefined) next[key] = value;
  }
  return next;
}

function syncOutcomeFromFields(body: ReturnType<typeof parseBody>, fields: WriteFields): void {
  if (fields.call_outcome) {
    body.outcome = { ...body.outcome, semanticOutcome: fields.call_outcome as typeof body.outcome.semanticOutcome };
  }
  if (fields.qualification) {
    body.outcome = { ...body.outcome, qualification: fields.qualification as typeof body.outcome.qualification };
  }
  if (fields.qualification_reason !== undefined) {
    body.outcome = { ...body.outcome, qualificationReason: fields.qualification_reason };
  }
  if (fields.objections !== undefined) {
    body.outcome = {
      ...body.outcome,
      objections: fields.objections.split(";").map((item) => item.trim()).filter(Boolean)
    };
  }
  if (fields.next_step !== undefined) {
    body.outcome = { ...body.outcome, nextStep: fields.next_step };
  }
  if (fields.follow_up_at !== undefined) {
    body.outcome = { ...body.outcome, followUpAt: fields.follow_up_at.trim() ? fields.follow_up_at : null };
  }
  if (fields.call_summary !== undefined) {
    body.outcome = { ...body.outcome, summary: fields.call_summary };
  }
}

export async function patchProposalFields(
  ctx: AppContext,
  proposalId: string,
  edits: WriteFields
): Promise<PublicProposal> {
  if (!ctx.finalizer) {
    throw new ReviewError("unconfigured", "Review is not configured", 503);
  }
  const row = getProposalOrThrow(ctx.db, proposalId);
  if (row.status !== "pending_review" && row.status !== "pending_retry") {
    throw new ReviewError("state", `Proposal cannot be edited in status ${row.status}`);
  }
  const body = parseBody(row);
  const fields = operatorEdits(body.kind, edits);
  if (Object.keys(fields).length === 0) {
    throw new ReviewError("invalid_edits", "No application-owned fields to change");
  }
  body.fields = applyFieldEdits(body.fields, fields);
  syncOutcomeFromFields(body, fields);
  updateProposalBody(ctx.db, row.id, body, parseEvidence(row), row.status);
  return ctx.finalizer.present(getProposalOrThrow(ctx.db, row.id));
}

export async function discardProposal(ctx: AppContext, proposalId: string): Promise<PublicProposal> {
  if (!ctx.finalizer) {
    throw new ReviewError("unconfigured", "Review is not configured", 503);
  }
  const row = getProposalOrThrow(ctx.db, proposalId);
  if (row.status === "applied") {
    throw new ReviewError("state", "Applied proposals cannot be discarded");
  }
  markProposalDiscarded(ctx.db, proposalId);
  return ctx.finalizer.present(getProposalOrThrow(ctx.db, proposalId));
}

export async function retryProcessing(ctx: AppContext, proposalId: string): Promise<PublicProposal> {
  if (!ctx.finalizer) {
    throw new ReviewError("unconfigured", "Review is not configured", 503);
  }
  const row = getProposalOrThrow(ctx.db, proposalId);
  const body = parseBody(row);
  if (body.kind !== "connected") {
    throw new ReviewError("state", "Non-connect outcomes do not use LLM extraction");
  }
  if (row.status === "applied" || row.status === "discarded") {
    throw new ReviewError("state", "Proposal can no longer be reprocessed");
  }
  if (!row.session_id) {
    throw new ReviewError("state", "Proposal has no call session");
  }
  updateProposalBody(ctx.db, row.id, body, parseEvidence(row), "processing");
  return ctx.finalizer.finalize(row.session_id);
}
