import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { researchSourceSchema } from "../../shared/campaigns.js";
import type { ResearchInput, ResearchResult } from "./client.js";

export const DEFAULT_RESEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalize(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

export function researchCacheKey(input: ResearchInput): string {
  return createHash("sha256").update(JSON.stringify({
    company: normalize(input.company),
    fullName: normalize(input.fullName),
    role: normalize(input.role),
    enrichment: normalize(input.enrichment).slice(0, 6000)
  })).digest("hex");
}

function parseCached(row: { report: string; sources_json: string; searched_at: string }): ResearchResult | null {
  try {
    const sources = JSON.parse(row.sources_json) as unknown[];
    if (!Array.isArray(sources)) return null;
    const parsed = sources.map((source) => researchSourceSchema.parse(source));
    return { report: row.report, sources: parsed, searchedAt: row.searched_at };
  } catch {
    return null;
  }
}

export function getCachedResearch(
  db: Database.Database,
  input: ResearchInput,
  ttlMs: number
): ResearchResult | null {
  if (ttlMs <= 0) return null;
  const row = db.prepare("SELECT report, sources_json, searched_at FROM research_cache WHERE key = ?")
    .get(researchCacheKey(input)) as { report: string; sources_json: string; searched_at: string } | undefined;
  if (!row) return null;
  if (Date.now() - Date.parse(row.searched_at) >= ttlMs) return null;
  return parseCached(row);
}

export function putCachedResearch(
  db: Database.Database,
  input: ResearchInput,
  result: ResearchResult
): void {
  // Only cache evidence-backed results; failures and sourceless reports retry live next time.
  if (!result.sources.length || !result.report.trim()) return;
  db.prepare(`INSERT INTO research_cache (key, input_json, report, sources_json, searched_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET input_json = excluded.input_json, report = excluded.report,
      sources_json = excluded.sources_json, searched_at = excluded.searched_at`)
    .run(researchCacheKey(input), JSON.stringify(input), result.report, JSON.stringify(result.sources), result.searchedAt);
}

export function pruneStaleResearchCache(db: Database.Database, ttlMs: number): void {
  if (ttlMs <= 0) {
    db.prepare("DELETE FROM research_cache").run();
    return;
  }
  db.prepare("DELETE FROM research_cache WHERE searched_at <= ?")
    .run(new Date(Date.now() - ttlMs).toISOString());
}
