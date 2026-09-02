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
  return { ok: true, output };
}
