import type { Env } from "../env.js";
import type { LlmClient, LlmCompleteInput } from "./types.js";

function llmConfigured(env: Env): boolean {
  return Boolean(env.LLM_BASE_URL?.trim() && env.LLM_API_KEY?.trim() && env.LLM_MODEL?.trim());
}

export function createLlmClient(env: Env): LlmClient | null {
  if (!llmConfigured(env)) {
    return null;
  }
  const base = env.LLM_BASE_URL!.replace(/\/$/, "");
  const apiKey = env.LLM_API_KEY!;
  const model = env.LLM_MODEL!;
  const timeoutMs = env.LLM_TIMEOUT_MS;

  return {
    async completeJson(input: LlmCompleteInput): Promise<string> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: input.user }
            ]
          }),
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`LLM HTTP ${response.status}`);
        }
        const body = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = body.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("LLM returned empty content");
        }
        return content;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
