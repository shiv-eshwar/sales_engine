import { defineAgent } from "eve";
import { prospectBriefSchema } from "../../src/shared/campaigns.js";

// Eve agent definition for prospect research briefs. See live-coach/agent.ts
// for how `model` relates to the locally configured LLM endpoint.
export default defineAgent({
  description: "Prepares one cited prospect brief from campaign strategy, CRM data, and web research.",
  model: "openai/gpt-5.6-luna",
  outputSchema: prospectBriefSchema,
});
