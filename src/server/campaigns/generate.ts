import { randomUUID } from "node:crypto";
import { z } from "zod";
import { campaignStrategySchema, type CampaignBrief } from "../../shared/campaigns.js";
import { campaignConfigSchema } from "../../shared/schemas.js";
import type { LlmClient } from "../llm/types.js";
import type { ManagedCampaign } from "./store.js";
import { renderAgentSystem } from "../agents/loader.js";

export async function generateCampaign(llm: LlmClient, brief: CampaignBrief, timeoutMs: number, previous?: ManagedCampaign, requestId?: string): Promise<ManagedCampaign> {
  const raw = await llm.completeJson({
    system: renderAgentSystem("campaign-generation", JSON.stringify(z.toJSONSchema(campaignStrategySchema))),
    user: JSON.stringify({ offering: brief }),
    timeoutMs
  });
  const strategy = campaignStrategySchema.parse(JSON.parse(raw));
  const id = previous?.config.id ?? `campaign-${requestId ?? randomUUID()}`;
  const config = campaignConfigSchema.parse({
    id,
    name: strategy.name,
    type: brief.type,
    version: (previous?.config.version ?? 0) + 1,
    objective: brief.objective,
    opening_context: strategy.opening,
    approved_claims: brief.approvedFacts.map((text, index) => ({
      id: `approved_${index + 1}`, text, evidence: "Operator-approved campaign fact"
    })),
    required_questions: strategy.questions.map(({ id, prompt, required }) => ({ id, prompt, required })),
    forbidden_behaviors: ["invent_claims", "promise_guaranteed_results", "argue_with_contact", "ignore_do_not_contact"],
    success_outcomes: strategy.successOutcomes,
    terminal_outcomes: ["not_interested", "disqualified", "do_not_contact", "wrong_person", "wrong_number"],
    qualification: {
      criteria: Object.fromEntries(strategy.criteria.map(item => [item.id, { prompt: item.prompt, required_for_qualified: item.required, negative_outcome: item.onNo }])),
      disqualifiers: strategy.disqualifiers
    }
  });
  const now = new Date().toISOString();
  return { config, brief, strategy, createdAt: previous?.createdAt ?? now, updatedAt: now };
}
