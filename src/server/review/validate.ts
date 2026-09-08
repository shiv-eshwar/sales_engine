import type { CampaignConfig, PostCallOutcome } from "../../shared/schemas.js";
import { postCallOutcomeSchema } from "../../shared/schemas.js";
import { evidenceInContext } from "../coach/evidence.js";
import type { LeadSnapshot } from "../calls/ledger.js";
import type { PublicUtterance } from "../transcript/utterances.js";

const SALES_CLOSE = new Set(["meeting_booked"]);

function isIsoDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

export function validatePostCallOutcome(
  raw: unknown,
  input: {
    campaign: CampaignConfig;
    utterances: PublicUtterance[];
    snapshot: LeadSnapshot;
  }
): { ok: true; output: PostCallOutcome } | { ok: false; reason: string } {
  const parsed = postCallOutcomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "schema" };
  }
  const output = parsed.data;
  const allowed = new Set([
    ...input.campaign.success_outcomes,
    ...input.campaign.terminal_outcomes,
    "conversation_incomplete",
    "unknown",
    "do_not_contact",
    "disqualified",
    "wrong_person"
  ]);
  if (!allowed.has(output.semanticOutcome)) {
    return { ok: false, reason: "unknown outcome" };
  }
  if (
    (input.campaign.type === "research" || input.campaign.type === "networking") &&
    SALES_CLOSE.has(output.semanticOutcome)
  ) {
    return { ok: false, reason: "sales-close outcome not allowed" };
  }
  if (output.followUpAt && !isIsoDateTime(output.followUpAt)) {
    return { ok: false, reason: "followUpAt" };
  }
  for (const [id, criterion] of Object.entries(output.criteria)) {
    if (!input.campaign.qualification.criteria[id]) {
      return { ok: false, reason: `unknown criterion ${id}` };
    }
    if (
      (criterion.state === "yes" || criterion.state === "no") &&
      !evidenceInContext(criterion.evidence, input.utterances, input.snapshot)
    ) {
      return { ok: false, reason: "evidence not in context" };
    }
  }
  if (output.qualification === "qualified") {
    const required = Object.entries(input.campaign.qualification.criteria).filter(([, spec]) => spec.required_for_qualified);
    if (!required.length || required.some(([id]) => output.criteria[id]?.state !== "yes")) {
      return { ok: false, reason: "missing required qualification evidence" };
    }
  }
  return { ok: true, output };
}

/**
 * Graceful fallback for live extraction: instead of discarding the whole LLM
 * outcome when only some criteria lack grounded evidence, downgrade the
 * offending criteria to `unknown` and keep the rest (semantic outcome,
 * summary, next step). Returns null when the outcome cannot be salvaged
 * (unknown outcome value, sales-close on a non-sales campaign).
 */
export function sanitizePostCallOutcome(
  raw: unknown,
  input: {
    campaign: CampaignConfig;
    utterances: PublicUtterance[];
    snapshot: LeadSnapshot;
  }
): { output: PostCallOutcome; downgraded: string[]; notes: string[] } | null {
  const parsed = postCallOutcomeSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const output = parsed.data;
  const allowed = new Set([
    ...input.campaign.success_outcomes,
    ...input.campaign.terminal_outcomes,
    "conversation_incomplete",
    "unknown",
    "do_not_contact",
    "disqualified",
    "wrong_person"
  ]);
  if (!allowed.has(output.semanticOutcome)) {
    return null;
  }
  if (
    (input.campaign.type === "research" || input.campaign.type === "networking") &&
    SALES_CLOSE.has(output.semanticOutcome)
  ) {
    return null;
  }
  const downgraded: string[] = [];
  const notes: string[] = [];
  if (output.followUpAt && !isIsoDateTime(output.followUpAt)) {
    output.followUpAt = null;
    notes.push("followUpAt was not a valid date and was cleared");
  }
  for (const [id, criterion] of Object.entries(output.criteria)) {
    if (!input.campaign.qualification.criteria[id]) {
      downgraded.push(id);
      continue;
    }
    if (
      (criterion.state === "yes" || criterion.state === "no") &&
      !evidenceInContext(criterion.evidence, input.utterances, input.snapshot)
    ) {
      downgraded.push(id);
    }
  }
  for (const id of downgraded) {
    if (input.campaign.qualification.criteria[id]) {
      output.criteria[id] = { state: "unknown", evidence: null, confidence: 0 };
    } else {
      delete output.criteria[id];
    }
  }
  for (const id of Object.keys(input.campaign.qualification.criteria)) {
    if (!output.criteria[id]) {
      output.criteria[id] = { state: "unknown", evidence: null, confidence: 0 };
    }
  }
  if (output.qualification === "qualified") {
    const required = Object.entries(input.campaign.qualification.criteria).filter(([, spec]) => spec.required_for_qualified);
    if (!required.length || required.some(([id]) => output.criteria[id]?.state !== "yes")) {
      output.qualification = "unknown";
      notes.push("qualification downgraded from qualified: required criteria lack grounded evidence");
    }
  }
  return { output, downgraded, notes };
}
