import type { CampaignConfig, PlaybookConfig } from "../../shared/schemas.js";
import { campaignCoachingRules } from "./campaignRules.js";
import type { CriterionState } from "./qualification.js";
import type { TalkRatio } from "./talkRatio.js";
import { GAP_TEXT, type PublicUtterance } from "../transcript/utterances.js";
import type { LeadSnapshot } from "../calls/ledger.js";

const KEEP_VERBATIM = 20;
const SUMMARY_CHARS = 1500;

export function rollingTranscript(utterances: PublicUtterance[]): { summary: string; recent: PublicUtterance[] } {
  const usable = utterances.filter((row) => row.text !== GAP_TEXT);
  if (usable.length <= KEEP_VERBATIM) {
    return { summary: "", recent: usable };
  }
  const older = usable.slice(0, -KEEP_VERBATIM);
  const recent = usable.slice(-KEEP_VERBATIM);
  const summary = older
    .map((row) => `${row.speaker}: ${row.text}`)
    .join(" ")
    .slice(0, SUMMARY_CHARS);
  return { summary, recent };
}

export function buildCoachPrompt(input: {
  campaign: CampaignConfig;
  playbook: PlaybookConfig | null;
  snapshot: LeadSnapshot;
  utterances: PublicUtterance[];
  criteria: Record<string, CriterionState>;
  talk: TalkRatio;
  stage: string;
  priorObjections: string[];
  sequence: number;
  connectedSeconds: number;
}): { system: string; user: string } {
  const { summary, recent } = rollingTranscript(input.utterances);
  const system = [
    "You are a live call coach for one human operator. Return JSON only matching LiveCoachOutput.",
    "Never invent customer names, results, prices, integrations, guarantees, or unapproved claims.",
    "Cues must be at most 160 characters. shouldShow false is valid. Do not fill space.",
    "Use only campaign configuration, playbook, CRM snapshot, and the provided transcript.",
    ...campaignCoachingRules(input.campaign)
  ].join(" ");

  const user = JSON.stringify({
    basedOnSequence: input.sequence,
    campaign: {
      type: input.campaign.type,
      objective: input.campaign.objective,
      successOutcomes: input.campaign.success_outcomes,
      terminalOutcomes: input.campaign.terminal_outcomes,
      forbidden: input.campaign.forbidden_behaviors,
      qualification: input.campaign.qualification,
      approvedClaims: input.campaign.approved_claims
    },
    lead: input.snapshot,
    state: {
      stage: input.stage,
      connectedSeconds: input.connectedSeconds,
      talkRatio: { callerShare: input.talk.callerShare, contactShare: input.talk.contactShare },
      criteria: input.criteria,
      unresolved: Object.entries(input.criteria)
        .filter(([, value]) => value.state === "unknown")
        .map(([id]) => id),
      priorObjections: input.priorObjections
    },
    playbook: input.playbook
      ? {
          principles: input.playbook.principles,
          objectionFlow: input.playbook.objection_flow,
          objections: input.playbook.objections,
          objectionGuides: input.playbook.objection_guides ?? {},
          stages: input.playbook.stages
        }
      : null,
    transcriptSummary: summary,
    recentUtterances: recent.map((row) => ({
      speaker: row.speaker,
      text: row.text,
      sequence: row.sequence
    }))
  });

  return { system, user };
}
