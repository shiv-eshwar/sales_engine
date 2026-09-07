import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/index.js";
import { applyTransportStatus, getSession, type LeadSnapshot } from "../../src/server/calls/ledger.js";
import { buildCoachPrompt } from "../../src/server/coach/prompt.js";
import { emptyCriteria } from "../../src/server/coach/qualification.js";
import { computeTalkRatio } from "../../src/server/coach/talkRatio.js";
import { validatePostCallOutcome } from "../../src/server/review/validate.js";
import type { PublicCampaign } from "../../src/shared/contracts.js";
import type { ProspectPreparation } from "../../src/shared/campaigns.js";
import { getAppContext, loginCookie, makeTestEnv, startTestApp } from "../helpers/app.js";
import { FakeLlmClient, postCallOutput } from "../helpers/llm.js";
import { offering, strategy, prospectBrief, fakeResearch } from "../helpers/campaigns.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

async function setup(research = true) {
  const llm = new FakeLlmClient();
  const { app } = await startTestApp({}, { initialCampaigns: [], llmClient: llm, researchClient: research ? fakeResearch : null });
  apps.push(app);
  const cookie = await loginCookie(app);
  const ctx = getAppContext(app);
  async function create(name: string, tag = "") {
    llm.enqueueJson(strategy(name));
    const response = await app.inject({ method: "POST", url: "/api/campaigns", headers: { cookie }, payload: {
      requestId: randomUUID(), brief: { ...offering(name), sheetCampaignValue: tag }
    } });
    expect(response.statusCode, response.body).toBe(201);
    return response.json() as PublicCampaign;
  }
  async function prepare(campaignId: string, leadId = "L-100") {
    llm.enqueueJson(prospectBrief(research));
    const response = await app.inject({ method: "POST", url: `/api/campaigns/${campaignId}/leads/${leadId}/prepare`, headers: { cookie }, payload: {} });
    expect(response.statusCode, response.body).toBe(200);
    return response.json() as ProspectPreparation;
  }
  return { app, llm, ctx, cookie, create, prepare };
}

describe("AI campaigns and prospect preparation", () => {
  it("starts production without example campaigns and exposes first-campaign setup", async () => {
    const env = await makeTestEnv({ NODE_ENV: "production" });
    const app = await buildApp(env, { disableLogger: true }); apps.push(app);
    const cookie = await loginCookie(app);
    const response = await app.inject({ url: "/api/bootstrap", headers: { cookie } });
    expect(response.json().campaigns).toEqual([]);
    expect(response.json().lead).toBeNull();
    expect((await app.inject({ url: "/health/ready" })).statusCode).toBe(200);
  });

  it("supports open access and keeps invalid generation out of saved campaigns", async () => {
    const { app, llm, cookie, ctx } = await setup();
    const payload = { requestId: randomUUID(), brief: offering() };
    llm.enqueueRaw("not json");
    expect((await app.inject({ method: "POST", url: "/api/campaigns", headers: { cookie }, payload })).statusCode).toBe(502);
    expect(ctx.campaignStore.list()).toEqual([]);
    llm.enqueueJson(strategy());
    const created = await app.inject({ method: "POST", url: "/api/campaigns", payload });
    expect(created.statusCode).toBe(201);
    const repeated = await app.inject({ method: "POST", url: "/api/campaigns", headers: { cookie }, payload });
    expect(repeated.json().id).toBe(created.json().id);
    expect(ctx.campaignStore.list()).toHaveLength(1);
    expect(llm.calls).toHaveLength(2);
  });

  it("keeps offerings, lead queues and skipped leads separate, without changing Sheet tags", async () => {
    const { app, cookie, ctx, create, llm } = await setup();
    const invoices = await create("Invoice assistant");
    const security = await create("Security training");
    for (const [id, leadIds] of [[invoices.id, ["L-100"]], [security.id, ["L-101"]]] as const) {
      expect((await app.inject({ method: "POST", url: `/api/campaigns/${id}/leads`, headers: { cookie }, payload: { leadIds, assigned: true } })).statusCode).toBe(200);
      const selected = await app.inject({ method: "POST", url: "/api/campaigns/select", headers: { cookie }, payload: { campaignId: id } });
      expect(selected.json().lead.leadId).toBe(leadIds[0]);
    }
    expect(JSON.parse(llm.calls[1]!.user).offering.offeringName).toBe("Security training");
    expect(llm.calls[1]!.user).not.toContain("Invoice assistant");
    expect((await ctx.adapter!.findLeadById("L-100"))!.campaignId).toBe("lamina-sales");
    expect((await app.inject({ method: "POST", url: "/api/calls/sessions", headers: { cookie }, payload: { leadId: "L-100", campaignId: security.id } })).statusCode).toBe(409);
    ctx.campaignStore.assign(security.id, ["L-100"], true);
    await app.inject({ method: "POST", url: "/api/leads/skip", headers: { cookie }, payload: { leadId: "L-100", campaignId: invoices.id } });
    const selected = await app.inject({ method: "POST", url: "/api/campaigns/select", headers: { cookie }, payload: { campaignId: security.id } });
    expect(selected.json().lead.leadId).toBe("L-100");
  });

  it("supports matching an existing CRM tag and explicit removal from that campaign", async () => {
    const { app, cookie, create } = await setup();
    const campaign = await create("Invoices", "lamina-sales");
    const response = await app.inject({ url: "/api/bootstrap", headers: { cookie } });
    expect(response.json().lead.leadId).toBe("L-100");
    await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/leads`, headers: { cookie }, payload: { leadIds: ["L-100"], assigned: false } });
    const next = await app.inject({ url: "/api/leads/next", headers: { cookie } });
    expect(next.json().lead.leadId).not.toBe("L-100");
  });

  it("requires the correct fresh preparation, and freezes generated questions and criteria for coaching and review", async () => {
    const { app, cookie, ctx, create, prepare, llm } = await setup();
    const campaign = await create("Invoices", "lamina-sales");
    const other = await create("Security", "lamina-sales");
    const request = (preparationId?: string) => app.inject({ method: "POST", url: "/api/calls/sessions", headers: { cookie }, payload: { leadId: "L-100", campaignId: campaign.id, preparationId } });
    expect((await request()).statusCode).toBe(409);
    const otherPrep = await prepare(other.id);
    expect((await request(otherPrep.id)).statusCode).toBe(409);
    const preparation = await prepare(campaign.id);
    const response = await request(preparation.id);
    expect(response.statusCode, response.body).toBe(201);
    const session = getSession(ctx.db, response.json().id)!;
    const snapshot = JSON.parse(session.lead_snapshot_json) as LeadSnapshot;
    expect(snapshot.campaign!.required_questions).toEqual(preparation.brief.questions.map(({ id, prompt, required }) => ({ id, prompt, required })));
    expect(snapshot.offering!.offeringName).toBe("Invoices");
    const inventedQualification = validatePostCallOutcome(postCallOutput({
      qualification: "qualified", criteria: { invoice_pain: { state: "yes", evidence: preparation.brief.company[0]!.text, confidence: 1 } }
    }), { campaign: snapshot.campaign!, snapshot, utterances: [] });
    expect(inventedQualification.ok).toBe(false);
    const missingQualification = validatePostCallOutcome(postCallOutput({ qualification: "qualified", criteria: {} }), { campaign: snapshot.campaign!, snapshot, utterances: [] });
    expect(missingQualification.ok).toBe(false);
    const changed = strategy("Updated invoice strategy");
    changed.criteria = [{ id: "new_criterion", prompt: "New qualification question?", required: true, onNo: "disqualified" }];
    llm.enqueueJson(changed);
    const update = await app.inject({ method: "PUT", url: `/api/campaigns/${campaign.id}`, headers: { cookie }, payload: { expectedVersion: 1, brief: offering("Updated invoices") } });
    expect(update.statusCode, update.body).toBe(200);
    expect(update.json().version).toBe(2);
    expect(ctx.coachEngine.getSnapshot(session.id)!.qualification[0]!.id).toBe("invoice_pain");
    const prompt = buildCoachPrompt({ campaign: snapshot.campaign!, snapshot, utterances: [], criteria: emptyCriteria(snapshot.campaign!),
      talk: computeTalkRatio([], null, null), stage: "opener", priorObjections: [], sequence: 1, connectedSeconds: 0, playbook: null });
    expect(JSON.parse(prompt.user).preparation.id).toBe(preparation.id);
    expect(prompt.user).not.toContain("Updated invoices");
    applyTransportStatus(ctx.db, session.id, "canceled");
    const proposal = await ctx.finalizer!.finalize(session.id);
    expect(proposal.criteria[0]!.id).toBe("invoice_pain");
    expect((await request(preparation.id)).statusCode).toBe(409);
  });

  it("deduplicates preparation, scopes its cache to campaign and lead content, and rejects invented citations", async () => {
    const { app, cookie, ctx, llm, create } = await setup();
    const campaign = await create("Invoices", "lamina-sales");
    const managed = ctx.campaignStore.get(campaign.id)!;
    const lead = (await ctx.adapter!.findLeadById("L-100"))!;
    llm.enqueueJson(prospectBrief(), 20);
    const [first, second] = await Promise.all([ctx.preparation.prepare(managed, lead), ctx.preparation.prepare(managed, lead)]);
    expect(first.id).toBe(second.id);
    expect(llm.calls).toHaveLength(2); // One campaign, one preparation.
    expect((await ctx.preparation.prepare(managed, lead)).id).toBe(first.id);
    expect(ctx.preparation.cached(managed, { ...lead, company: "A different company" })).toBeNull();
    expect(ctx.preparation.matches(first, managed, { ...lead, enrichment: "Changed context" })).toBe(false);
    const invented = prospectBrief();
    invented.company[0]!.sourceIds = ["invented_source"];
    llm.enqueueJson(invented);
    const response = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/leads/L-100/prepare`, headers: { cookie }, payload: { force: true } });
    expect(response.statusCode).toBe(502);
    expect(ctx.preparation.cached(managed, lead)!.id).toBe(first.id);
  });

  it("clearly labels CRM-only briefs and never turns unsourced claims into research", async () => {
    const { create, prepare, llm, ctx } = await setup(false);
    const campaign = await create("Invoices", "lamina-sales");
    const result = await prepare(campaign.id);
    expect(result.research.status).toBe("unavailable");
    expect(result.research.warnings.join(" ")).toContain("CRM context only");
    expect(result.brief.company).toEqual([]);
    expect(llm.calls[1]!.user).not.toContain("phone");
    llm.enqueueJson(prospectBrief(true));
    await expect(ctx.preparation.prepare(ctx.campaignStore.get(campaign.id)!, (await ctx.adapter!.findLeadById("L-100"))!, true)).rejects.toThrow("unknown source");
  });

  it("persists campaigns, lead assignments and briefs across app restarts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sales-campaigns-"));
    const llm = new FakeLlmClient();
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;
    try {
      const env = await makeTestEnv({ DATABASE_PATH: join(dir, "ledger.sqlite") });
      app = await buildApp(env, { initialCampaigns: [], llmClient: llm, researchClient: fakeResearch });
      const cookie = await loginCookie(app);
      llm.enqueueJson(strategy());
      const created = await app.inject({ method: "POST", url: "/api/campaigns", headers: { cookie }, payload: { requestId: randomUUID(), brief: offering() } });
      const id = created.json().id;
      const ctx = getAppContext(app);
      ctx.campaignStore.assign(id, ["L-100"], true);
      llm.enqueueJson(prospectBrief());
      const brief = await ctx.preparation.prepare(ctx.campaignStore.get(id)!, (await ctx.adapter!.findLeadById("L-100"))!);
      await app.close(); app = undefined;
      app = await buildApp(env, { initialCampaigns: [], llmClient: llm, researchClient: fakeResearch });
      const restored = getAppContext(app);
      expect(restored.campaigns[0]!.name).toBe("Invoice discovery");
      const lead = (await restored.adapter!.findLeadById("L-100"))!;
      expect(restored.campaignStore.includes(id, lead)).toBe(true);
      expect(restored.preparation.cached(restored.campaignStore.get(id)!, lead)!.id).toBe(brief.id);
    } finally {
      await app?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
