import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, openDatabase } from "../../src/server/db/index.js";
import {
  getCachedResearch,
  pruneStaleResearchCache,
  putCachedResearch,
  researchCacheKey
} from "../../src/server/research/cache.js";
import type { ResearchInput, ResearchResult } from "../../src/server/research/client.js";
import type { PublicCampaign } from "../../src/shared/contracts.js";
import type { ProspectPreparation } from "../../src/shared/campaigns.js";
import { getAppContext, loginCookie, startTestApp, bindSampleSheet } from "../helpers/app.js";
import { offering, prospectBrief, strategy } from "../helpers/campaigns.js";
import { FakeLlmClient } from "../helpers/llm.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function freshDb() {
  const db = openDatabase(":memory:");
  migrate(db, "migrations");
  return db;
}

const input: ResearchInput = { company: "Acme", fullName: "Ada Example", role: "Founder", enrichment: "property management" };

function result(searchedAt = new Date().toISOString()): ResearchResult {
  return {
    report: "Acme does property management software (https://example.com).",
    sources: [{ id: "source_1", title: "Acme", url: "https://example.com" }],
    searchedAt
  };
}

describe("research cache", () => {
  it("keys on normalized prospect input", () => {
    expect(researchCacheKey({ ...input, company: "  ACME " })).toBe(researchCacheKey(input));
    expect(researchCacheKey({ ...input, company: "Other" })).not.toBe(researchCacheKey(input));
    expect(researchCacheKey({ ...input, fullName: "Someone Else" })).not.toBe(researchCacheKey(input));
  });

  it("returns stored results within the TTL and misses when stale", () => {
    const db = freshDb();
    try {
      expect(getCachedResearch(db, input, 7 * DAY_MS)).toBeNull();
      putCachedResearch(db, input, result());
      expect(getCachedResearch(db, input, 7 * DAY_MS)?.sources).toHaveLength(1);
      expect(getCachedResearch(db, input, 0)).toBeNull();
      putCachedResearch(db, input, result(new Date(Date.now() - 8 * DAY_MS).toISOString()));
      expect(getCachedResearch(db, input, 7 * DAY_MS)).toBeNull();
    } finally {
      db.close();
    }
  });

  it("ignores corrupt rows and never stores sourceless or empty results", () => {
    const db = freshDb();
    try {
      putCachedResearch(db, input, result());
      db.prepare("UPDATE research_cache SET sources_json = 'not json' WHERE key = ?").run(researchCacheKey(input));
      expect(getCachedResearch(db, input, 7 * DAY_MS)).toBeNull();
      putCachedResearch(db, input, { report: "nothing", sources: [], searchedAt: new Date().toISOString() });
      expect(getCachedResearch(db, input, 7 * DAY_MS)).toBeNull();
      putCachedResearch(db, input, { ...result(), report: "   " });
      expect(getCachedResearch(db, input, 7 * DAY_MS)).toBeNull();
    } finally {
      db.close();
    }
  });

  it("prunes stale rows", () => {
    const db = freshDb();
    try {
      putCachedResearch(db, input, result());
      putCachedResearch(db, { ...input, company: "Old" }, result(new Date(Date.now() - 30 * DAY_MS).toISOString()));
      pruneStaleResearchCache(db, 7 * DAY_MS);
      const keys = (db.prepare("SELECT key FROM research_cache").all() as Array<{ key: string }>).map(row => row.key);
      expect(keys).toEqual([researchCacheKey(input)]);
    } finally {
      db.close();
    }
  });
});

describe("preparation reuses cached research", () => {
  const apps: Awaited<ReturnType<typeof startTestApp>>["app"][] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

  it("searches once per prospect across campaigns and re-searches on force refresh", async () => {
    const llm = new FakeLlmClient();
    let researchCalls = 0;
    const research = {
      async research(researchInput: ResearchInput): Promise<ResearchResult> {
        researchCalls += 1;
        void researchInput;
        return result();
      }
    };
    const { app } = await startTestApp({}, { initialCampaigns: [], llmClient: llm, researchClient: research });
    apps.push(app);
    const cookie = await loginCookie(app);
    const ctx = getAppContext(app);
    async function create(name: string): Promise<PublicCampaign> {
      const requestId = randomUUID();
      await bindSampleSheet(app, cookie, requestId);
      llm.enqueueJson(strategy(name));
      const response = await app.inject({ method: "POST", url: "/api/campaigns", headers: { cookie }, payload: {
        requestId, brief: { ...offering(name), sheetCampaignValue: "" }
      } });
      expect(response.statusCode, response.body).toBe(201);
      return response.json() as PublicCampaign;
    }
    async function prepare(campaignId: string, force = false): Promise<ProspectPreparation> {
      llm.enqueueJson(prospectBrief(true));
      const response = await app.inject({ method: "POST", url: `/api/campaigns/${campaignId}/leads/L-100/prepare`, headers: { cookie }, payload: { force } });
      expect(response.statusCode, response.body).toBe(200);
      return response.json() as ProspectPreparation;
    }
    const first = await create("First");
    const second = await create("Second");
    const briefA = await prepare(first.id);
    expect(researchCalls).toBe(1);
    const briefB = await prepare(second.id);
    expect(researchCalls).toBe(1);
    expect(briefB.id).not.toBe(briefA.id);
    expect(briefB.campaignId).toBe(second.id);
    const refreshed = await prepare(first.id, true);
    expect(researchCalls).toBe(2);
    expect(refreshed.id).not.toBe(briefA.id);
  });
});
