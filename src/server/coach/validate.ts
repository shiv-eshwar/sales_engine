import type { CampaignConfig, PlaybookConfig } from "../../shared/schemas.js";
import { cueClaimsApproved } from "./claims.js";
import { evidenceInContext } from "./evidence.js";
import type { LiveCoachOutput } from "./schema.js";
import type { LeadSnapshot } from "../calls/ledger.js";
import type { PublicUtterance } from "../transcript/utterances.js";

const FIRST_OBJECTION_OK = new Set(["clarify", "listen", "qualify", "warning"]);

export type ValidationResult =
  | { ok: true; output: LiveCoachOutput }
  | { ok: false; reason: string };

export function validateLiveCoachOutput(
  output: LiveCoachOutput,
  input: {
    campaign: CampaignConfig;
    playbook: PlaybookConfig | null;
    utterances: PublicUtterance[];
    snapshot: LeadSnapshot;
    firstObjection: boolean;
  }
): ValidationResult {
  const { campaign, playbook, utterances, snapshot, firstObjection } = input;
  const maxChars = playbook?.cue_max_characters ?? 160;
  if (output.cue.length > maxChars) {
    return { ok: false, reason: "cue too long" };
  }
  for (const update of output.qualificationUpdates) {
    if (!campaign.qualification.criteria[update.criterion]) {
      return { ok: false, reason: `unknown criterion ${update.criterion}` };
    }
    if (
      (update.state === "yes" || update.state === "no") &&
      !evidenceInContext(update.evidence, utterances, snapshot)
    ) {
      return { ok: false, reason: "evidence not in context" };
    }
  }
  const allowedOutcomes = new Set([...campaign.success_outcomes, ...campaign.terminal_outcomes, "qualified", "disqualified", "defer", "unknown", "do_not_contact"]);
  if (output.recommendedOutcome && !allowedOutcomes.has(output.recommendedOutcome)) {
    return { ok: false, reason: "unknown outcome" };
  }
  if (output.detectedObjection && playbook && !playbook.objections.includes(output.detectedObjection)) {
    return { ok: false, reason: "unknown objection" };
  }
  if (!cueClaimsApproved(output.cue, campaign)) {
    return { ok: false, reason: "unapproved claim" };
  }
  if (firstObjection && output.detectedObjection && !FIRST_OBJECTION_OK.has(output.cueType)) {
    return { ok: false, reason: "first objection must clarify or diagnose" };
  }
  if (campaign.type === "networking" && output.cueType === "objection") {
    return { ok: false, reason: "networking cannot use sales-objection cues" };
  }
  return { ok: true, output };
}
