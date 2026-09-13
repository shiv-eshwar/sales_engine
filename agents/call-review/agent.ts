import { defineAgent } from "eve";
import { reviewInterviewTurnSchema } from "../../src/shared/schemas.js";

export default defineAgent({
  description: "Reviews a finished call with the operator in chat, can draft a Calendar event for Approve, and invokes approve, edit, retry, or skip on the stored CRM proposal.",
  model: "openai/gpt-5.6-luna",
  outputSchema: reviewInterviewTurnSchema,
});
