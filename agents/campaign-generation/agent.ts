import { defineAgent } from "eve";
import { campaignStrategySchema } from "../../src/shared/campaigns.js";

// Eve agent definition for campaign generation. See live-coach/agent.ts for
// how `model` relates to the locally configured LLM endpoint.
export default defineAgent({
  description: "Generates one campaign strategy (questions, qualification, objections) from an operator offering brief.",
  model: "openai/gpt-5.6-luna",
  outputSchema: campaignStrategySchema,
});
