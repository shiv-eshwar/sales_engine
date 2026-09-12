import { defineAgent } from "eve";
import { campaignInterviewTurnSchema } from "../../src/shared/campaigns.js";

// Eve agent definition for the campaign-creation interview. The local runner
// (src/server/agents/loader.ts) executes structured turns through the
// configured OpenAI-compatible LLM endpoint; `model` below is the eve-gateway
// equivalent used when this agent runs under `eve dev`.
export default defineAgent({
  description: "Interviews an operator in chat and emits a campaign offering brief when enough detail is present.",
  model: "openai/gpt-5.6-luna",
  outputSchema: campaignInterviewTurnSchema,
});
