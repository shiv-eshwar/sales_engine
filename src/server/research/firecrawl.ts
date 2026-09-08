import { isPublicWebUrl, type ResearchSource } from "../../shared/campaigns.js";
import type { ResearchInput, ResearchResult } from "./client.js";

const SEARCH_ENDPOINT = "https://api.firecrawl.dev/v2/search";

type FirecrawlWebItem = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

type FirecrawlSearchBody = {
  success?: boolean;
  error?: string;
  data?: { web?: FirecrawlWebItem[] };
};

export function buildFirecrawlQuery(input: ResearchInput): string {
  const parts = [input.company, input.fullName, input.role].map(part => part.trim()).filter(Boolean);
  const base = parts.slice(0, 3).join(" ").slice(0, 180) || "company prospect";
  const enrichmentHint = input.enrichment.trim().slice(0, 120);
  return enrichmentHint ? `${base} ${enrichmentHint}`.slice(0, 280) : base;
}

export function toResearchResult(items: FirecrawlWebItem[], searchedAt: string): ResearchResult {
  const sources: ResearchSource[] = [];
  const lines: string[] = [];
  for (const item of items) {
    const url = item.url?.trim() ?? "";
    if (!url || !isPublicWebUrl(url) || sources.length >= 30) continue;
    if (sources.some(source => source.url === url)) continue;
    const id = `source_${sources.length + 1}`;
    const title = (item.title?.trim() || new URL(url).hostname).slice(0, 500);
    sources.push({ id, title, url });
    const excerpt = (item.description?.trim() || item.markdown?.trim().slice(0, 600) || "").slice(0, 600);
    lines.push(`[${id}] ${title} (${url})${excerpt ? ` — ${excerpt}` : ""}`);
  }
  return {
    report: lines.join("\n").slice(0, 12000),
    sources,
    searchedAt
  };
}

export function createFirecrawlResearchClient(options: { apiKey: string; timeoutMs: number }): import("./client.js").ResearchClient {
  const apiKey = options.apiKey.trim();
  return {
    async research(input: ResearchInput): Promise<ResearchResult> {
      if (!apiKey) throw new Error("Firecrawl research is not configured. Set FIRECRAWL_API_KEY.");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await fetch(SEARCH_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            query: buildFirecrawlQuery(input),
            limit: 8,
            sources: [{ type: "web" }]
          }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Firecrawl search HTTP ${response.status}. Check FIRECRAWL_API_KEY and quota.`);
        const body = (await response.json()) as FirecrawlSearchBody;
        if (body.success === false) throw new Error(`Firecrawl search failed: ${body.error ?? "unknown error"}`);
        const result = toResearchResult(body.data?.web ?? [], new Date().toISOString());
        if (!result.report) throw new Error("Firecrawl search returned no usable results.");
        return result;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
