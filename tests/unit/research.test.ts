import { afterEach, describe, expect, it, vi } from "vitest";
import { parseResearchResponse, createResearchClient } from "../../src/server/research/client.js";
import { campaignStrategySchema, isPublicWebUrl } from "../../src/shared/campaigns.js";
import { strategy } from "../helpers/campaigns.js";
import { makeTestEnv } from "../helpers/app.js";

afterEach(() => vi.unstubAllGlobals());

describe("Research evidence boundary", () => {
  it("uses provider citations, ignoring authored URLs and unsafe link schemes", () => {
    const result = parseResearchResponse({ status: "completed", output: [
      { type: "web_search_call", status: "completed", action: { sources: [{ url: "https://unquoted.example.com" }] } },
      { type: "message", content: [{ type: "output_text", text: "A company fact. https://invented.example.com", annotations: [
        { type: "url_citation", title: "Company", url: "https://example.com/company" },
        { type: "url_citation", title: "Duplicate", url: "https://example.com/company" },
        { type: "url_citation", title: "Unsafe", url: "javascript:alert(1)" }
      ] }] }
    ] });
    expect(result.sources).toEqual([{ id: "source_1", title: "Company", url: "https://example.com/company" }]);
  });

  it("does not label incomplete responses or model-only answers as web research", () => {
    expect(() => parseResearchResponse({ status: "incomplete", output: [] })).toThrow("did not complete");
    expect(() => parseResearchResponse({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Known from memory" }] }] })).toThrow("did not perform");
  });

  it("does not send LLM credentials to a different research provider", async () => {
    const env = await makeTestEnv({ LLM_BASE_URL: "https://example.com/v1", LLM_API_KEY: "secret", LLM_MODEL: "model" });
    expect(createResearchClient(env)).toBeNull();
    expect(createResearchClient({ ...env, RESEARCH_BASE_URL: "https://different.example.com/v1" })).toBeNull();
  });

  it("requests actual web search and citations through the configured Responses endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [
      { type: "web_search_call", status: "completed" },
      { type: "message", content: [{ type: "output_text", text: "Example makes software.", annotations: [{ type: "url_citation", url: "https://example.com", title: "Example" }] }] }
    ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const env = await makeTestEnv({ LLM_BASE_URL: "https://api.openai.com/v1", LLM_API_KEY: "test-key", LLM_MODEL: "configured-model" });
    const client = createResearchClient(env)!;
    const result = await client.research({ fullName: "Ada Example", company: "Example", role: "Founder", enrichment: "" });
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.openai.com/v1/responses");
    const input = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(input.model).toBe("configured-model");
    expect(input.tool_choice).toBe("required");
    expect(input.tools).toEqual([{ type: "web_search" }]);
    expect(input.store).toBe(false);
    expect(input.input).toEqual([{ role: "user", content: expect.any(String) }]);
    expect(JSON.parse(input.input[0].content).prospect.company).toBe("Example");
    expect(result.sources[0]!.url).toBe("https://example.com");
  });

  it("rejects local/private, credential-bearing, and non-web source URLs", () => {
    for (const url of ["http://localhost/", "http://127.0.0.1/", "http://10.0.0.1/", "http://[::1]/", "https://foo.internal/", "https://user:pass@example.com/", "file:///etc/passwd", "javascript:alert(1)"]) {
      expect(isPublicWebUrl(url)).toBe(false);
    }
    expect(isPublicWebUrl("https://example.com/about")).toBe(true);
  });

  it("rejects duplicate question IDs and qualification with no required evidence", () => {
    const value = strategy();
    value.questions[1]!.id = value.questions[0]!.id;
    expect(campaignStrategySchema.safeParse(value).success).toBe(false);
    const emptyQualification = strategy();
    emptyQualification.criteria[0]!.required = false;
    expect(campaignStrategySchema.safeParse(emptyQualification).success).toBe(false);
  });
});
