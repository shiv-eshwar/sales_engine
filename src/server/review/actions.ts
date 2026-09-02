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
): Promise<{ proposal: PublicProposal; lead: PublicLead | null; sheet: BootstrapResponse["sheet"] }> {
  if (!ctx.adapter || !ctx.sheetsConfig || !ctx.finalizer) {
    throw new ReviewError("unconfigured", "Sheet is not configured", 503);
  }
  const row = getProposalOrThrow(ctx.db, proposalId);
  if (row.status !== "pending_review" && row.status !== "pending_retry") {
    throw new ReviewError("state", `Proposal cannot be approved in status ${row.status}`);
  }
  const body = parseBody(row);
  const fields = applyFieldEdits(body.fields, edits);
  if (fields.call_outcome === "do_not_contact") {
    fields.call_status = DNC_CALL_STATUS;
    body.outcome = { ...body.outcome, semanticOutcome: "do_not_contact" };
  }
  body.fields = fields;
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
      sheet: next.sheetStatus
    };
  }
  markProposalApplied(ctx.db, row.id, body);
  const applied = getProposalOrThrow(ctx.db, row.id);
  const next = await loadNextLead(ctx);
  return {
    proposal: ctx.finalizer.present(applied),
    lead: next.lead,
    sheet: next.sheetStatus
  };
}

export async function skipNonConnect(ctx: AppContext, proposalId: string) {
  return approveProposal(ctx, proposalId, { call_status: SKIPPED_CALL_STATUS });
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
