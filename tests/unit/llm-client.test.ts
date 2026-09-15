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

it("classifies revoked upstream login without blaming the proxy key or leaking the response", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
    message: "Encountered invalidated oauth token for user", code: "token_revoked", secret: "private-token"
  } }), { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  const env = await makeTestEnv({ LLM_BASE_URL: "http://localhost/v1", LLM_API_KEY: "test", LLM_MODEL: "test" });
  const client = createLlmClient(env)!;
  await expect(client.completeJson({ system: "Rules", user: "Input" })).rejects.toMatchObject({ code: "login_required" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(client.getHealth?.()).toMatchObject({ ok: false });
  expect(client.getHealth?.().message).not.toContain("private-token");
});

it("retries transient failures and records successful upstream generation", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }));
  vi.stubGlobal("fetch", fetcher);
  const env = await makeTestEnv({ LLM_BASE_URL: "http://localhost/v1", LLM_API_KEY: "test", LLM_MODEL: "test" });
  const client = createLlmClient(env)!;
  expect(client.getHealth?.()).toMatchObject({ ok: null });
  expect(await client.completeJson({ system: "Rules", user: "Input" })).toBe('{"ok":true}');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(client.getHealth?.()).toMatchObject({ ok: true, message: "AI generation verified" });
});

it("caps transient retries at three attempts", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response("unavailable", { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  const env = await makeTestEnv({ LLM_BASE_URL: "http://localhost/v1", LLM_API_KEY: "test", LLM_MODEL: "test" });
  await expect(createLlmClient(env)!.completeJson({ system: "Rules", user: "Input" })).rejects.toMatchObject({ code: "unavailable" });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("applies the overall timeout to retry-after waits", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("busy", { status: 429, headers: { "retry-after": "60" } }));
  vi.stubGlobal("fetch", fetcher);
  const env = await makeTestEnv({ LLM_BASE_URL: "http://localhost/v1", LLM_API_KEY: "test", LLM_MODEL: "test" });
  await expect(createLlmClient(env)!.completeJson({ system: "Rules", user: "Input", timeoutMs: 30 })).rejects.toMatchObject({ code: "timeout" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
