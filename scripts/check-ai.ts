// A small, explicit generation probe. Does not create or modify campaigns.
import { loadEnv } from "../src/server/env.js";
import { createLlmClient } from "../src/server/llm/client.js";
import { LlmError } from "../src/server/llm/errors.js";

try {
  const env = loadEnv(process.env.AI_ENV_FILE || ".env");
  const client = createLlmClient(env);
  if (!client) throw new Error("AI connection is not configured");
  const result = await client.completeJson({
    system: 'Return exactly the JSON object {"ok":true}.',
    user: "Check that generation is working.",
    timeoutMs: 30000
  });
  if (JSON.parse(result).ok !== true) throw new Error("AI probe did not return the expected JSON");
  console.log("PASS: authenticated upstream AI generation and JSON response verified");
} catch (error) {
  console.error(error instanceof LlmError ? `${error.code}: ${error.message}` : "AI generation probe failed; check provider configuration and response format");
  process.exitCode = 1;
}
