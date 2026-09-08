import { afterEach, describe, expect, it, vi } from "vitest";
import { parseResearchResponse, createResearchClient } from "../../src/server/research/client.js";
import { buildFirecrawlQuery, createFirecrawlResearchClient, toResearchResult } from "../../src/server/research/firecrawl.js";
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

describe("Firecrawl web research", () => {
  it("prefers Firecrawl when FIRECRAWL_API_KEY is configured", async () => {
    const env = await makeTestEnv({ FIRECRAWL_API_KEY: "fc-test-key" });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { web: [{ url: "https://example.com/company", title: "Company", description: "Makes software." }] }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const client = createResearchClient(env)!;
    const result = await client.research({ fullName: "Ada Example", company: "Example", role: "Founder", enrichment: "" });
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.firecrawl.dev/v2/search");
    expect(fetcher.mock.calls[0]![1].headers.authorization).toBe("Bearer fc-test-key");
    expect(result.sources).toEqual([{ id: "source_1", title: "Company", url: "https://example.com/company" }]);
    expect(result.report).toContain("Makes software.");
  });

  it("falls back to the Responses endpoint when no Firecrawl key is set", async () => {
    const env = await makeTestEnv({ LLM_BASE_URL: "https://api.openai.com/v1", LLM_API_KEY: "test-key", LLM_MODEL: "m" });
    expect(env.FIRECRAWL_API_KEY).toBeUndefined();
    expect(createResearchClient(env)).not.toBeNull();
  });

  it("builds a bounded query from prospect input", () => {
    expect(buildFirecrawlQuery({ company: "", fullName: "", role: "", enrichment: "" })).toBe("company prospect");
    const query = buildFirecrawlQuery({ company: "Acme", fullName: "Ada Example", role: "Founder", enrichment: "property management" });
    expect(query).toContain("Acme");
    expect(query.length).toBeLessThanOrEqual(280);
  });

  it("keeps only public, deduplicated source URLs", () => {
    const result = toResearchResult([
      { url: "https://example.com/a", title: "A", description: "First" },
      { url: "https://example.com/a", title: "Dupe" },
      { url: "javascript:alert(1)", title: "Unsafe" },
      { url: "http://localhost/", title: "Local" }
    ], new Date().toISOString());
    expect(result.sources).toEqual([{ id: "source_1", title: "A", url: "https://example.com/a" }]);
  });

  it("surfaces Firecrawl HTTP and empty-result failures so briefs warn instead of silently going CRM-only", async () => {
    const env = await makeTestEnv({ FIRECRAWL_API_KEY: "fc-test-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 402 })));
    await expect(createFirecrawlResearchClient({ apiKey: "fc-test-key", timeoutMs: 1000 })
      .research({ company: "Acme", fullName: "", role: "", enrichment: "" })).rejects.toThrow("HTTP 402");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { web: [] } }), { status: 200 })));
    await expect(createFirecrawlResearchClient({ apiKey: "fc-test-key", timeoutMs: 1000 })
      .research({ company: "Acme", fullName: "", role: "", enrichment: "" })).rejects.toThrow("no usable results");
  });
});
