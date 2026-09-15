import { setTimeout as delay } from "node:timers/promises";
import { LlmError, providerError } from "./errors.js";
import type { LlmHealth } from "./types.js";
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

  let health: LlmHealth = { ok: null, message: "AI configured; no generation verified yet", checkedAt: null };
  return {
    getHealth: () => ({ ...health }),
    async completeJson(input: LlmCompleteInput): Promise<string> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? timeoutMs);
      try {
        for (let attempt = 0; ; attempt++) {
          const useResponses = env.LLM_API_MODE === "responses";
          let response: Response;
          try {
            response = await fetch(`${base}/${useResponses ? "responses" : "chat/completions"}`, {
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
          } catch (error) {
            if (controller.signal.aborted) throw error;
            if (attempt < 2) {
              await delay(250 * 2 ** attempt, undefined, { signal: controller.signal });
              continue;
            }
            throw new LlmError("unavailable", "Cannot reach the AI service. Please try again shortly.");
          }
          if (!response.ok) {
            const error = providerError(response.status, (await response.text()).slice(0, 64000));
            if (attempt < 2 && error.code !== "login_required" && [429, 502, 503, 504].includes(response.status)) {
              const retryAfter = Number(response.headers.get("retry-after"));
              const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
              await delay(wait, undefined, { signal: controller.signal });
              continue;
            }
            throw error;
          }
          const body = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            status?: string;
            output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
          };
          if (useResponses && body.status !== "completed") {
            throw new LlmError("invalid_response", "LLM response did not complete. Please try again.");
          }
          const content = useResponses
            ? body.output?.filter(item => item.type === "message")
              .flatMap(item => item.content ?? [])
              .filter(item => item.type === "output_text")
              .map(item => item.text ?? "").join("")
            : body.choices?.[0]?.message?.content;
          if (!content) {
            throw new LlmError("invalid_response", "LLM returned empty content. Please try again.");
          }
          health = { ok: true, message: "AI generation verified", checkedAt: new Date().toISOString() };
          return content;
        }
      } catch (error) {
        const failure = controller.signal.aborted
          ? new LlmError("timeout", "The AI service took too long to respond. Please try again; your saved campaign is unchanged.")
          : error instanceof LlmError ? error
          : new LlmError("invalid_response", "The AI service returned an invalid response. Please try again.");
        health = { ok: false, message: failure.message, checkedAt: new Date().toISOString() };
        throw failure;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
