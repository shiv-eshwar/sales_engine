import { defineAgent } from "eve";
import { liveCoachOutputSchema } from "../../src/server/coach/schema.js";

// Eve agent definition for live call coaching. The local runner
// (src/server/agents/loader.ts) executes single structured turns through the
// configured OpenAI-compatible LLM endpoint; `model` below is the eve-gateway
// equivalent used when this agent runs under `eve dev`, while production
// resolves the concrete model from LLM_MODEL.
export default defineAgent({
  description: "Emits one short live coaching cue for an active sales call as structured JSON.",
  model: "openai/gpt-5.6-luna",
  outputSchema: liveCoachOutputSchema,
});
