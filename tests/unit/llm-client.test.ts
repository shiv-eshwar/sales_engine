import { afterEach, expect, it, vi } from "vitest";
import { createLlmClient } from "../../src/server/llm/client.js";
import { makeTestEnv } from "../helpers/app.js";

afterEach(() => vi.unstubAllGlobals());

it("extracts only completed Responses message text, excluding reasoning", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [
    { type: "reasoning", content: [{ type: "output_text", text: "private reasoning" }] },
    { type: "message", content: [{ type: "output_text", text: '{"ok":' }, { type: "output_text", text: 'true}' }] }
  ] }));
  vi.stubGlobal("fetch", fetcher);
  const env = await makeTestEnv({ LLM_BASE_URL: "http://127.0.0.1:4001/v1/", LLM_API_KEY: "test", LLM_MODEL: "sales-fast", LLM_API_MODE: "responses" });
  expect(await createLlmClient(env)!.completeJson({ system: "Rules", user: "Input" })).toBe('{"ok":true}');
  expect(fetcher.mock.calls[0]![0]).toBe("http://127.0.0.1:4001/v1/responses");
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ store: false, model: "sales-fast", input: [{ role: "user", content: "Input" }] });
});

it.each(["incomplete", "failed"])("rejects %s Responses results even with partial JSON", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status, output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] })));
  const env = await makeTestEnv({ LLM_BASE_URL: "http://localhost/v1", LLM_API_KEY: "test", LLM_MODEL: "test", LLM_API_MODE: "responses" });
  await expect(createLlmClient(env)!.completeJson({ system: "Rules", user: "Input" })).rejects.toThrow("did not complete");
});

it("preserves the default Chat Completions transport", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "{}" } }] }));
  vi.stubGlobal("fetch", fetcher);
  const env = await makeTestEnv({ LLM_BASE_URL: "http://localhost/v1", LLM_API_KEY: "test", LLM_MODEL: "test" });
  expect(await createLlmClient(env)!.completeJson({ system: "Rules", user: "Input" })).toBe("{}");
  expect(fetcher.mock.calls[0]![0]).toBe("http://localhost/v1/chat/completions");
});
