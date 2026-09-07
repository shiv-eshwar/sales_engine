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
      const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? timeoutMs);
      try {
        const useResponses = env.LLM_API_MODE === "responses";
        const response = await fetch(`${base}/${useResponses ? "responses" : "chat/completions"}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(useResponses ? {
            model,
            store: false,
            instructions: `${input.system}\nReturn only valid JSON, without markdown fences.`,
            input: [{ role: "user", content: input.user }]
          } : {
            model,
            store: false,
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
          status?: string;
          output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
        };
        if (useResponses && body.status !== "completed") {
          throw new Error("LLM response did not complete");
        }
        const content = useResponses
          ? body.output?.filter(item => item.type === "message")
            .flatMap(item => item.content ?? [])
            .filter(item => item.type === "output_text")
            .map(item => item.text ?? "").join("")
          : body.choices?.[0]?.message?.content;
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
