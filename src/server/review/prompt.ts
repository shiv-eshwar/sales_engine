import type { CampaignConfig, PlaybookConfig, PostCallOutcome } from "../../shared/schemas.js";
import { campaignCoachingRules } from "../coach/campaignRules.js";
import { GAP_TEXT, type PublicUtterance } from "../transcript/utterances.js";
import type { LeadSnapshot } from "../calls/ledger.js";
import type { CriterionState } from "../coach/qualification.js";
import type { TalkRatio } from "../coach/talkRatio.js";
import { z } from "zod";
import { postCallOutcomeSchema } from "../../shared/schemas.js";
import { renderAgentSystem } from "../agents/loader.js";

export function buildExtractionPrompt(input: {
  campaign: CampaignConfig;
  playbook: PlaybookConfig | null;
  snapshot: LeadSnapshot;
  utterances: PublicUtterance[];
  criteria: Record<string, CriterionState>;
  talk: TalkRatio;
  priorObjections: string[];
  transcriptComplete: boolean;
}): { system: string; user: string } {
  const system = [
    renderAgentSystem("post-call", `PostCallOutcome schema: ${JSON.stringify(z.toJSONSchema(postCallOutcomeSchema))}`),
    ...campaignCoachingRules(input.campaign)
  ].join(" ");

  const transcript = input.utterances
    .filter((row) => row.text !== GAP_TEXT)
    .slice(-200)
    .map((row) => ({
      id: row.id,
      speaker: row.speaker,
      text: row.text,
      sequence: row.sequence
    }));

  const user = JSON.stringify({
    campaign: {
      type: input.campaign.type,
      objective: input.campaign.objective,
      successOutcomes: input.campaign.success_outcomes,
      terminalOutcomes: input.campaign.terminal_outcomes,
      qualification: input.campaign.qualification,
      approvedClaims: input.campaign.approved_claims
    },
    lead: { fullName: input.snapshot.fullName, company: input.snapshot.company, role: input.snapshot.role },
    liveState: {
      criteria: input.criteria,
      priorObjections: input.priorObjections,
      talkRatio: { callerShare: input.talk.callerShare, contactShare: input.talk.contactShare }
    },
    playbook: input.playbook
      ? {
          principles: input.playbook.principles,
          objections: input.playbook.objections,
          objectionFlow: input.playbook.objection_flow,
          objectionGuides: input.playbook.objection_guides ?? {}
        }
      : null,
    transcriptComplete: input.transcriptComplete,
    transcript
  });

  return { system, user };
}

export function defaultConnectedOutcome(input: {
  campaign: CampaignConfig;
  transcriptComplete: boolean;
  doNotContact: boolean;
}): PostCallOutcome {
  const criteria: PostCallOutcome["criteria"] = {};
  for (const id of Object.keys(input.campaign.qualification.criteria)) {
    criteria[id] = { state: "unknown", evidence: null, confidence: 0 };
  }
  return {
    semanticOutcome: input.doNotContact ? "do_not_contact" : "conversation_incomplete",
    qualification: input.doNotContact ? "disqualified" : "unknown",
    qualificationReason: input.doNotContact
      ? "Contact asked not to be contacted."
      : "Post-call extraction was skipped or failed.",
    criteria,
    painOrResearchFindings: [],
    objections: input.doNotContact ? ["do_not_contact"] : [],
    nextStep: input.doNotContact ? "Do not contact this person again." : "",
    followUpAt: null,
    summary: input.doNotContact
      ? "Contact asked not to be contacted."
      : "Post-call extraction was skipped or failed.",
    callerCommitments: [],
    contactCommitments: [],
    transcriptComplete: input.transcriptComplete,
    confidence: input.doNotContact ? 1 : 0
  };
}
