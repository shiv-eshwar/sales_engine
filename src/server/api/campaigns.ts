import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { campaignBriefSchema } from "../../shared/campaigns.js";
import { requireSession } from "../auth/routes.js";
import { generateCampaign } from "../campaigns/generate.js";
import type { AppContext } from "../context.js";
import { toPublicLead } from "../leads/nextLead.js";
import { toPublicCampaign } from "./leads.js";

const createSchema = z.object({ brief: campaignBriefSchema, requestId: z.uuid() });
const updateSchema = z.object({ brief: campaignBriefSchema, expectedVersion: z.number().int().positive() });

function generationError(error: unknown): string {
  if (error instanceof Error && error.message === "LLM HTTP 401") return "The AI provider rejected the API key. Update LLM_API_KEY and restart the server, then try again.";
  if (error instanceof Error && /^(LLM HTTP|Campaign changed|Configure the LLM|Generated brief cited)/.test(error.message)) return error.message;
  return "AI generation failed or returned an invalid result. Check the AI connection and try again; your saved campaign is unchanged.";
}

export async function registerCampaigns(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };
  const generating = new Set<string>();

  app.post("/api/campaigns", { preHandler: auth }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Provide an offering, target customer, objective and valid campaign details." });
    if (!ctx.llmClient) return reply.code(503).send({ error: "Configure the LLM connection before creating a campaign." });
    if (ctx.shuttingDown) return reply.code(503).send({ error: "Server is restarting. Try again shortly." });
    const { brief, requestId } = parsed.data;
    const existing = ctx.campaignStore.get(`campaign-${requestId}`);
    if (existing) {
      if (JSON.stringify(existing.brief) !== JSON.stringify(brief)) return reply.code(409).send({ error: "This request already created a different campaign. Reload before creating another." });
      return toPublicCampaign(existing.config, ctx);
    }
    if (generating.has(requestId) || generating.size >= 2) return reply.code(409).send({ error: "Campaign generation is already in progress. Wait for it to finish." });
    generating.add(requestId);
    try {
      const campaign = await generateCampaign(ctx.llmClient, brief, ctx.env.AI_GENERATION_TIMEOUT_MS, undefined, requestId);
      ctx.campaignStore.save(campaign);
      ctx.campaigns.push(campaign.config);
      ctx.operator.selectedCampaignId = campaign.config.id;
      ctx.operator.selectedLeadId = null;
      return reply.code(201).send(toPublicCampaign(campaign.config, ctx));
    } catch (error) {
      return reply.code(502).send({ error: generationError(error) });
    } finally {
      generating.delete(requestId);
    }
  });

  app.put("/api/campaigns/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Provide valid campaign details and the current version." });
    const previous = ctx.campaignStore.get(id);
    if (!previous) return reply.code(404).send({ error: "Editable campaign not found" });
    if (previous.config.version !== parsed.data.expectedVersion) return reply.code(409).send({ error: "Campaign changed. Reload before editing it." });
    if (!ctx.llmClient) return reply.code(503).send({ error: "Configure the LLM connection before updating a campaign." });
    if (ctx.shuttingDown) return reply.code(503).send({ error: "Server is restarting. Try again shortly." });
    if (generating.has(id) || generating.size >= 2) return reply.code(409).send({ error: "Campaign generation is already in progress." });
    generating.add(id);
    try {
      const campaign = await generateCampaign(ctx.llmClient, parsed.data.brief, ctx.env.AI_GENERATION_TIMEOUT_MS, previous);
      ctx.campaignStore.save(campaign, parsed.data.expectedVersion);
      const index = ctx.campaigns.findIndex(item => item.id === id);
      ctx.campaigns.splice(index, 1, campaign.config);
      return toPublicCampaign(campaign.config, ctx);
    } catch (error) {
      return reply.code(502).send({ error: generationError(error) });
    } finally {
      generating.delete(id);
    }
  });

  app.get("/api/campaigns/:id/leads", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ctx.campaigns.some(item => item.id === id)) return reply.code(404).send({ error: "Campaign not found" });
    if (!ctx.adapter) return reply.code(503).send({ error: "Sheet is not configured" });
    const queue = await ctx.adapter.loadQueue();
    const belongs = ctx.campaignStore.membership(id);
    return { leads: queue.leads.map(lead => ({
      leadId: lead.leadId, fullName: lead.fullName, company: lead.company, role: lead.role,
      sheetCampaign: lead.campaignId, assigned: belongs(lead)
    })) };
  });

  app.post("/api/campaigns/:id/leads", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ctx.campaigns.some(item => item.id === id)) return reply.code(404).send({ error: "Campaign not found" });
    const parsed = z.object({ leadIds: z.array(z.string().min(1).max(200)).min(1).max(1000), assigned: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Select eligible leads to assign or remove." });
    if (!ctx.adapter) return reply.code(503).send({ error: "Sheet is not configured" });
    const queue = await ctx.adapter.loadQueue();
    const eligible = new Set(queue.leads.map(lead => lead.leadId));
    if (parsed.data.leadIds.some(leadId => !eligible.has(leadId))) return reply.code(409).send({ error: "A selected lead is no longer eligible. Refresh the list." });
    ctx.campaignStore.assign(id, parsed.data.leadIds, parsed.data.assigned);
    return { ok: true };
  });

  app.post("/api/campaigns/:id/leads/:leadId/prepare", { preHandler: auth }, async (request, reply) => {
    const { id, leadId } = request.params as { id: string; leadId: string };
    const parsed = z.object({ force: z.boolean().default(false) }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid preparation request" });
    if (ctx.shuttingDown) return reply.code(503).send({ error: "Server is restarting. Try again shortly." });
    const campaign = ctx.campaignStore.get(id);
    if (!campaign) return reply.code(404).send({ error: "AI campaign not found" });
    if (!ctx.llmClient) return reply.code(503).send({ error: "Configure the LLM connection to prepare this call." });
    const lead = await ctx.adapter?.findLeadById(leadId);
    if (!lead) return reply.code(404).send({ error: "Lead is not eligible" });
    if (!ctx.campaignStore.includes(id, lead)) return reply.code(409).send({ error: "Lead is not assigned to this campaign" });
    try {
      const preparation = await ctx.preparation.prepare(campaign, toPublicLead(lead), parsed.data.force);
      if (ctx.campaignStore.get(id)?.config.version !== campaign.config.version || !ctx.campaignStore.includes(id, lead)) {
        return reply.code(409).send({ error: "Campaign or lead assignment changed while preparing. Refresh and try again." });
      }
      return preparation;
    } catch (error) {
      return reply.code(502).send({ error: generationError(error) });
    }
  });
}
