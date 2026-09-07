import { defineAgent } from "eve";
import { postCallOutcomeSchema } from "../../src/shared/schemas.js";

// Eve agent definition for post-call extraction. See live-coach/agent.ts for
// how `model` relates to the locally configured LLM endpoint.
export default defineAgent({
  description: "Extracts one structured post-call CRM proposal from a finished call transcript.",
  model: "openai/gpt-5.6-luna",
  outputSchema: postCallOutcomeSchema,
});
