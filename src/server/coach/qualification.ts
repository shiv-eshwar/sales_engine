import type { CampaignConfig } from "../../shared/schemas.js";
import { evidenceInContext } from "./evidence.js";
import type { LiveCoachOutput } from "./schema.js";
import type { LeadSnapshot } from "../calls/ledger.js";
import type { PublicUtterance } from "../transcript/utterances.js";

export type CriterionState = {
  state: "yes" | "no" | "unknown";
  evidence: string | null;
  source: "transcript" | "crm" | null;
  confidence: number;
};

export type QualificationView = {
  id: string;
  prompt: string;
  state: "yes" | "no" | "unknown";
  evidence: string | null;
};

export function emptyCriteria(campaign: CampaignConfig): Record<string, CriterionState> {
  const result: Record<string, CriterionState> = {};
  for (const id of Object.keys(campaign.qualification.criteria)) {
    result[id] = { state: "unknown", evidence: null, source: null, confidence: 0 };
  }
  return result;
}

export function applyQualificationUpdates(
  campaign: CampaignConfig,
  current: Record<string, CriterionState>,
  updates: LiveCoachOutput["qualificationUpdates"],
  utterances: PublicUtterance[],
  snapshot: LeadSnapshot
): Record<string, CriterionState> {
  const next = { ...current };
  for (const update of updates) {
    if (!campaign.qualification.criteria[update.criterion]) {
      continue;
    }
    if (update.state === "yes" || update.state === "no") {
      if (!evidenceInContext(update.evidence, utterances, snapshot)) {
        continue;
      }
    }
    next[update.criterion] = {
      state: update.state,
      evidence: update.evidence,
      source: update.evidence ? "transcript" : null,
      confidence: update.confidence
    };
  }
  return next;
}

export function recommendOutcome(
  campaign: CampaignConfig,
  criteria: Record<string, CriterionState>,
  input: { doNotContact: boolean; detectedObjection: string | null }
): string | null {
  const disqualifiers = new Set(campaign.qualification.disqualifiers);
  if (input.doNotContact && disqualifiers.has("explicit_do_not_contact")) {
    return "do_not_contact";
  }
  if (input.detectedObjection === "do_not_contact" && disqualifiers.has("explicit_do_not_contact")) {
    return "do_not_contact";
  }
  if (criteria.relevant_problem?.state === "no" && disqualifiers.has("no_relevant_problem")) {
    return "disqualified";
  }
  if (criteria.influence?.state === "no" && disqualifiers.has("no_influence_and_no_referral")) {
    return "disqualified";
  }
  if (
    input.detectedObjection === "existing_solution" &&
    disqualifiers.has("existing_solution_fully_satisfies_need") &&
    criteria.relevant_problem?.state === "no"
  ) {
    return "disqualified";
  }
  const required = Object.entries(campaign.qualification.criteria).filter(
    ([, spec]) => spec.required_for_qualified
  );
  if (required.length > 0 && required.every(([id]) => criteria[id]?.state === "yes")) {
    return "qualified";
  }
  if (criteria.timing?.state === "no") {
    return "defer";
  }
  return "unknown";
}

export function qualificationView(
  campaign: CampaignConfig,
  criteria: Record<string, CriterionState>
): QualificationView[] {
  return Object.entries(campaign.qualification.criteria).map(([id, spec]) => ({
    id,
    prompt: spec.prompt,
    state: criteria[id]?.state ?? "unknown",
    evidence: criteria[id]?.evidence ?? null
  }));
}
