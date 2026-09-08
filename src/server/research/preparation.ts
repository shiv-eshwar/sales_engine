import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import { preparationSchema, prospectBriefSchema, type ProspectPreparation } from "../../shared/campaigns.js";
import type { PublicLead } from "../../shared/contracts.js";
import type { ManagedCampaign } from "../campaigns/store.js";
import { renderAgentSystem } from "../agents/loader.js";
import type { LlmClient } from "../llm/types.js";
import type { ResearchClient, ResearchResult } from "./client.js";
import { getCachedResearch, pruneStaleResearchCache, putCachedResearch } from "./cache.js";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function preparationInputHash(campaign: ManagedCampaign, lead: PublicLead): string {
  return createHash("sha256").update(JSON.stringify({
    campaign: campaign.config.id, version: campaign.config.version,
    lead: lead.leadId, company: lead.company, name: lead.fullName, role: lead.role, enrichment: lead.enrichment
  })).digest("hex");
}

export class PreparationService {
  private readonly pending = new Map<string, Promise<ProspectPreparation>>();
  constructor(private readonly deps: {
    db: Database.Database; llm: LlmClient | null; research: ResearchClient | null; timeoutMs: number;
    researchCacheTtlMs?: number;
  }) {}

  private researchInput(lead: PublicLead) {
    return {
      fullName: lead.fullName, company: lead.company, role: lead.role, enrichment: lead.enrichment.slice(0, 6000)
    };
  }

  private async liveResearch(lead: PublicLead, force: boolean): Promise<{ research: ResearchResult; fromCache: boolean }> {
    const input = this.researchInput(lead);
    const ttlMs = this.deps.researchCacheTtlMs ?? 0;
    if (!force) {
      const cached = getCachedResearch(this.deps.db, input, ttlMs);
      if (cached) return { research: cached, fromCache: true };
    }
    if (!this.deps.research) throw new Error("unconfigured");
    const fresh = await this.deps.research.research(input);
    if (ttlMs > 0) {
      putCachedResearch(this.deps.db, input, fresh);
      pruneStaleResearchCache(this.deps.db, ttlMs);
    }
    return { research: fresh, fromCache: false };
  }

  get(id: string): ProspectPreparation | null {
    const row = this.deps.db.prepare("SELECT body_json FROM prospect_preparations WHERE id = ?").get(id) as { body_json: string } | undefined;
    return row ? preparationSchema.parse(JSON.parse(row.body_json)) : null;
  }

  cached(campaign: ManagedCampaign, lead: PublicLead): ProspectPreparation | null {
    const row = this.deps.db.prepare(`SELECT body_json FROM prospect_preparations
      WHERE campaign_id = ? AND campaign_version = ? AND lead_id = ? AND input_hash = ? AND generated_at > ?
      ORDER BY generated_at DESC LIMIT 1`).get(campaign.config.id, campaign.config.version, lead.leadId,
      preparationInputHash(campaign, lead), new Date(Date.now() - MAX_AGE_MS).toISOString()) as { body_json: string } | undefined;
    return row ? preparationSchema.parse(JSON.parse(row.body_json)) : null;
  }

  matches(preparation: ProspectPreparation, campaign: ManagedCampaign, lead: PublicLead): boolean {
    return preparation.campaignId === campaign.config.id && preparation.campaignVersion === campaign.config.version &&
      preparation.leadId === lead.leadId && preparation.inputHash === preparationInputHash(campaign, lead) &&
      Date.now() - Date.parse(preparation.generatedAt) < MAX_AGE_MS;
  }

  prepare(campaign: ManagedCampaign, lead: PublicLead, force = false): Promise<ProspectPreparation> {
    const key = preparationInputHash(campaign, lead);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const cached = !force ? this.cached(campaign, lead) : null;
    if (cached) return Promise.resolve(cached);
    const promise = this.generate(campaign, lead, force).finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  private async generate(campaign: ManagedCampaign, lead: PublicLead, force = false): Promise<ProspectPreparation> {
    if (!this.deps.llm) throw new Error("Configure the LLM connection to generate a prospect brief.");
    let research: ResearchResult = { report: "", sources: [], searchedAt: new Date().toISOString() };
    let status: ProspectPreparation["research"]["status"] = "unavailable";
    const warnings: string[] = [];
    if (this.deps.research) {
      try {
        const { research: live, fromCache } = await this.liveResearch(lead, force);
        research = live;
        status = research.sources.length ? "complete" : "no_sources";
        if (fromCache) warnings.push(`Reused web research from ${research.searchedAt.slice(0, 10)}. Refresh the brief for a live re-search.`);
        if (!research.sources.length) warnings.push("Web research returned no cited sources. This brief uses CRM context only.");
      } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        warnings.push(`Web research failed (${cause.slice(0, 160)}). This brief uses CRM context only; retry research before relying on company or prospect facts.`);
      }
    } else {
      warnings.push("Web research is not configured. This brief uses CRM context only.");
    }
    const raw = await this.deps.llm.completeJson({
      system: renderAgentSystem("prospect-research", JSON.stringify(z.toJSONSchema(prospectBriefSchema))),
      user: JSON.stringify({
        offering: campaign.brief,
        strategy: campaign.strategy,
        lead: { fullName: lead.fullName, company: lead.company, role: lead.role, enrichment: lead.enrichment.slice(0, 6000) },
        research: status === "complete" ? research : { report: "No cited web evidence available.", sources: [] }
      }),
      timeoutMs: this.deps.timeoutMs
    });
    const brief = prospectBriefSchema.parse(JSON.parse(raw));
    const sourceIds = new Set(research.sources.map(source => source.id));
    for (const fact of [...brief.company, ...brief.prospect]) {
      if (fact.sourceIds.some(id => !sourceIds.has(id))) throw new Error("Generated brief cited an unknown source. Retry preparation.");
    }
    const result = preparationSchema.parse({
      id: randomUUID(), campaignId: campaign.config.id, campaignVersion: campaign.config.version,
      leadId: lead.leadId, inputHash: preparationInputHash(campaign, lead), generatedAt: new Date().toISOString(),
      research: { status, searchedAt: research.searchedAt, sources: research.sources, warnings }, brief
    });
    this.deps.db.prepare(`INSERT INTO prospect_preparations
      (id, campaign_id, campaign_version, lead_id, input_hash, generated_at, body_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(result.id, result.campaignId, result.campaignVersion, result.leadId, result.inputHash, result.generatedAt, JSON.stringify(result));
    return result;
  }
}
