import { z } from "zod";
import {
  reviewInterviewTurnSchema,
  type ReviewInterviewAction,
  type WriteFieldsInput
} from "../../shared/schemas.js";
import type { BootstrapResponse, PublicLead, PublicProposal } from "../../shared/contracts.js";
import { openingReviewMessage } from "../../shared/reviewOpening.js";
import type { LlmClient } from "../llm/types.js";
import { renderAgentSystem } from "../agents/loader.js";
import type { AppContext } from "../context.js";
import {
  approveProposal,
  discardProposal,
  patchProposalFields,
  retryProcessing,
  skipNonConnect,
  ReviewError
} from "./actions.js";

export type ReviewChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type ReviewInterviewResult = {
  text: string;
  proposal: PublicProposal;
  wrote: boolean;
  leftReview: boolean;
  lead: PublicLead | null;
  leads: PublicLead[];
  sheet: BootstrapResponse["sheet"] | null;
};

function compactProposal(proposal: PublicProposal) {
  return {
    id: proposal.id,
    status: proposal.status,
    kind: proposal.kind,
    contactName: proposal.contactName,
    leadId: proposal.leadId,
    transportOutcome: proposal.transportOutcome,
    semanticOutcome: proposal.semanticOutcome,
    qualification: proposal.qualification,
    qualificationReason: proposal.qualificationReason,
    criteria: proposal.criteria,
    painOrResearchFindings: proposal.painOrResearchFindings,
    objections: proposal.objections,
    nextStep: proposal.nextStep,
    followUpAt: proposal.followUpAt,
    summary: proposal.summary,
    warnings: proposal.warnings,
    proposedFields: proposal.proposedFields,
    diff: proposal.diff.filter((row) => row.key !== "twilio_call_sid" && row.key !== "recording_sid"),
    lastError: proposal.lastError,
    utterances: proposal.utterances.slice(-40).map((item) => ({
      speaker: item.speaker,
      text: item.text
    }))
  };
}

export async function interviewReviewTurn(
  llm: LlmClient,
  messages: ReviewChatMessage[],
  proposal: PublicProposal,
  timeoutMs: number
): Promise<{ message: string; action: ReviewInterviewAction; fields?: WriteFieldsInput }> {
  const raw = await llm.completeJson({
    system: renderAgentSystem("call-review", JSON.stringify(z.toJSONSchema(reviewInterviewTurnSchema))),
    user: JSON.stringify({
      conversation: messages,
      proposal: compactProposal(proposal)
    }),
    timeoutMs
  });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("AI generation failed or returned an invalid result. Check the AI connection and try again; the Sheet was not written.");
  }
  const parsed = reviewInterviewTurnSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("AI generation failed or returned an invalid result. Check the AI connection and try again; the Sheet was not written.");
  }
  return parsed.data;
}

export function bootstrapReviewReply(proposal: PublicProposal): ReviewInterviewResult {
  return {
    text: openingReviewMessage(proposal),
    proposal,
    wrote: false,
    leftReview: false,
    lead: null,
    leads: [],
    sheet: null
  };
}

export async function applyReviewInterviewAction(
  ctx: AppContext,
  proposal: PublicProposal,
  action: ReviewInterviewAction,
  fields: WriteFieldsInput | undefined,
  message: string
): Promise<ReviewInterviewResult> {
  if (action === "none") {
    return {
      text: message,
      proposal,
      wrote: false,
      leftReview: false,
      lead: null,
      leads: [],
      sheet: null
    };
  }
  if (action === "propose_fields") {
    const next = await patchProposalFields(ctx, proposal.id, fields ?? {});
    return {
      text: message,
      proposal: next,
      wrote: false,
      leftReview: false,
      lead: null,
      leads: [],
      sheet: null
    };
  }
  if (action === "retry_processing") {
    const next = await retryProcessing(ctx, proposal.id);
    return {
      text: message,
      proposal: next,
      wrote: false,
      leftReview: false,
      lead: null,
      leads: [],
      sheet: null
    };
  }
  if (action === "discard") {
    const next = await discardProposal(ctx, proposal.id);
    return {
      text: message,
      proposal: next,
      wrote: false,
      leftReview: true,
      lead: null,
      leads: [],
      sheet: null
    };
  }

  const result = action === "skip"
    ? await skipNonConnect(ctx, proposal.id)
    : await approveProposal(ctx, proposal.id, action === "approve" ? fields : undefined);
  const applied = result.proposal.status === "applied";
  return {
    text: message,
    proposal: result.proposal,
    wrote: applied,
    leftReview: applied,
    lead: result.lead,
    leads: result.leads,
    sheet: result.sheet
  };
}

export function isBootstrapTurn(messages: ReviewChatMessage[], bootstrap?: boolean): boolean {
  if (bootstrap) return true;
  return !messages.some((item) => item.role === "user");
}

function lastUserText(messages: ReviewChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return messages[index]!.content.trim();
  }
  return "";
}

/** Exact operator phrases from in-thread suggestions (and typed equivalents). */
export function intentFromUserMessage(
  text: string,
  proposal: PublicProposal
): { action: ReviewInterviewAction; fields?: WriteFieldsInput; message: string } | null {
  const value = text.trim().toLowerCase().replace(/[.!]+$/, "");
  if (!value) return null;
  if (
    value === "write this update" ||
    value === "write it" ||
    value === "approve" ||
    value === "confirm" ||
    value === "confirm the write" ||
    value === "yes write" ||
    value === "write to the sheet"
  ) {
    return { action: "approve", message: "Writing the update to the Sheet, then opening the next contact." };
  }
  if (value === "retry the sheet write" || value === "retry write") {
    return { action: "retry_write", message: "Retrying the same Sheet write." };
  }
  if (value === "retry later" || (value === "retry" && proposal.kind === "non_connect")) {
    return {
      action: "approve",
      fields: { call_status: "Retry" },
      message: "Marking this contact to retry. Nothing else was invented."
    };
  }
  if (value === "skip this contact" || value === "skip") {
    return { action: "skip", message: "Skipping this contact without changing semantic CRM fields." };
  }
  if (value === "discard this proposal" || value === "discard") {
    return { action: "discard", message: "Discarded the proposal. The Sheet was not written." };
  }
  return null;
}

export function resolveReviewTurn(
  messages: ReviewChatMessage[],
  proposal: PublicProposal
): { action: ReviewInterviewAction; fields?: WriteFieldsInput; message: string } | null {
  return intentFromUserMessage(lastUserText(messages), proposal);
}
