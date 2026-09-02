import type { CampaignConfig, PostCallOutcome } from "../../shared/schemas.js";

export type ProposalKind = "connected" | "non_connect";

export type StoredProposalBody = {
  kind: ProposalKind;
  llmUsed: boolean;
  leadId: string;
  campaignId: string;
  snapshotPhone: string;
  contactName: string;
  transportOutcome: string | null;
  outcome: PostCallOutcome;
  fields: Record<string, string>;
  currentFields: Record<string, string>;
  warnings: string[];
};

export function emptyPostCallOutcome(input: {
  transcriptComplete: boolean;
  campaign: CampaignConfig;
  semanticOutcome?: PostCallOutcome["semanticOutcome"];
  qualification?: PostCallOutcome["qualification"];
  reason?: string;
}): PostCallOutcome {
  const criteria: PostCallOutcome["criteria"] = {};
  for (const id of Object.keys(input.campaign.qualification.criteria)) {
    criteria[id] = { state: "unknown", evidence: null, confidence: 0 };
  }
  return {
    semanticOutcome: input.semanticOutcome ?? "conversation_incomplete",
    qualification: input.qualification ?? "unknown",
    qualificationReason: input.reason ?? "No structured extraction was available.",
    criteria,
    painOrResearchFindings: [],
    objections: [],
    nextStep: "",
    followUpAt: null,
    summary: input.reason ?? "No structured extraction was available.",
    callerCommitments: [],
    contactCommitments: [],
    transcriptComplete: input.transcriptComplete,
    confidence: 0
  };
}
