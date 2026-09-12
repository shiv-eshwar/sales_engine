import type { CampaignConfig } from "../../shared/schemas.js";

export function campaignCoachingRules(campaign: CampaignConfig): string[] {
  const rules = [
    `Campaign type: ${campaign.type}.`,
    `Objective: ${campaign.objective}`,
    `Forbidden: ${campaign.forbidden_behaviors.join("; ")}`
  ];
  if (campaign.type === "sales") {
    rules.push("Optimize for diagnosis, qualification, and an appropriate next step.");
    rules.push("Opener: context-first then Problem Proposition. Never how's-your-day or bad-time.");
    rules.push("The first cue for an objection must agree specifically then clarify, never rebut or pitch.");
    rules.push("Outside objective is a dual-calendar meeting or a next action they will do, not a demo dump.");
    rules.push("Never label the lead qualified without evidence for every required criterion.");
  } else if (campaign.type === "research") {
    rules.push("Optimize for valid evidence, concrete recent examples, and exact language.");
    rules.push("Do not pitch unless the contact asks. Prefer neutral questions.");
  } else {
    rules.push("Optimize for learning, reciprocity, and an appropriate follow-up.");
    rules.push("Do not emit aggressive closing or sales-objection handling cues.");
  }
  return rules;
}
