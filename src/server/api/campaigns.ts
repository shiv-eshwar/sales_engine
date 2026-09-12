import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { campaignBriefSchema } from "../../shared/campaigns.js";
import { requireSession } from "../auth/routes.js";
import { generateCampaign } from "../campaigns/generate.js";
import { interviewCampaignTurn } from "../campaigns/interview.js";
import type { AppContext } from "../context.js";
import { toPublicLead } from "../leads/nextLead.js";
import { toPublicCampaign } from "./leads.js";
import { activateCampaignSheet, peekPendingSheet, SheetBindingError, takePendingSheet } from "../sheets/bind.js";

const createSchema = z.object({ brief: campaignBriefSchema, requestId: z.uuid() });
const updateSchema = z.object({ brief: campaignBriefSchema, expectedVersion: z.number().int().positive() });
const interviewSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().trim().min(1).max(20000)
  })).min(1).max(40),
  requestId: z.uuid(),
  campaignId: z.string().min(1).max(200).optional()
});

function generationError(error: unknown): string {
  if (error instanceof SheetBindingError) return error.message;
  if (error instanceof Error && error.message === "LLM HTTP 401") return "The AI provider rejected the API key. Update LLM_API_KEY and restart the server, then try again.";
  if (error instanceof Error && /^(LLM HTTP|Campaign changed|Configure the LLM|Generated brief cited|That Sheet is already|Connect a unique)/.test(error.message)) return error.message;
  return "AI generation failed or returned an invalid result. Check the AI connection and try again; your saved campaign is unchanged.";
}

function generationStatus(error: unknown): number {
  if (error instanceof SheetBindingError) return error.http;
  if (error instanceof Error && error.message.startsWith("Connect a unique")) return 400;
  if (error instanceof Error && error.message.startsWith("That Sheet is already")) return 409;
  return 502;
}

export async function registerCampaigns(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };
  const generating = new Set<string>();

  app.post("/api/campaigns/interview", { preHandler: auth }, async (request, reply) => {
    const parsed = interviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Send the campaign conversation so far." });
    if (!ctx.llmClient) return reply.code(503).send({ error: "Configure the LLM connection before creating a campaign." });
    if (ctx.shuttingDown) return reply.code(503).send({ error: "Server is restarting. Try again shortly." });
    const previous = parsed.data.campaignId ? ctx.campaignStore.get(parsed.data.campaignId) ?? undefined : undefined;
    if (parsed.data.campaignId && !previous) return reply.code(404).send({ error: "Editable campaign not found" });
    const lockKey = previous?.config.id ?? parsed.data.requestId;
    if (generating.has(lockKey) || generating.size >= 2) {
      return reply.code(409).send({ error: "Campaign generation is already in progress. Wait for it to finish." });
    }
    generating.add(lockKey);
    try {
      const turn = await interviewCampaignTurn(
        ctx.llmClient,
        parsed.data.messages,
        ctx.env.AI_GENERATION_TIMEOUT_MS,
        previous
      );
      if (!turn.brief) {
        return { text: turn.message, campaign: null };
      }
      if (!previous) {
        const existing = ctx.campaignStore.get(`campaign-${parsed.data.requestId}`);
        if (existing) {
          return { text: turn.message, campaign: toPublicCampaign(existing.config, ctx) };
        }
        peekPendingSheet(ctx, parsed.data.requestId);
      }
      const campaign = await generateCampaign(
        ctx.llmClient,
        turn.brief,
        ctx.env.AI_GENERATION_TIMEOUT_MS,
        previous,
        previous ? undefined : parsed.data.requestId
      );
      if (previous) {
        ctx.campaignStore.save(campaign, previous.config.version);
        const index = ctx.campaigns.findIndex(item => item.id === previous.config.id);
        ctx.campaigns.splice(index, 1, campaign.config);
      } else {
        const sheet = takePendingSheet(ctx, parsed.data.requestId);
        campaign.spreadsheetId = sheet.spreadsheet_id;
        campaign.sheetName = sheet.sheet_name;
        try {
          ctx.campaignStore.save(campaign);
        } catch (error) {
          ctx.pendingSheets.set(parsed.data.requestId, sheet);
          throw error;
        }
        ctx.campaigns.push(campaign.config);
        ctx.operator.selectedCampaignId = campaign.config.id;
        ctx.operator.selectedLeadId = null;
        await activateCampaignSheet(ctx, campaign.config.id);
      }
      const created = toPublicCampaign(campaign.config, ctx);
      const suffix = previous
        ? `Updated ${created.name} (strategy v${created.version}). You can keep calling.`
        : `Created ${created.name}. Eligible Sheet contacts are ready to call.`;
      return { text: `${turn.message}\n\n${suffix}`, campaign: created };
    } catch (error) {
      return reply.code(generationStatus(error)).send({ error: generationError(error) });
    } finally {
      generating.delete(lockKey);
    }
  });

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
      peekPendingSheet(ctx, requestId);
      const campaign = await generateCampaign(ctx.llmClient, brief, ctx.env.AI_GENERATION_TIMEOUT_MS, undefined, requestId);
      const sheet = takePendingSheet(ctx, requestId);
      campaign.spreadsheetId = sheet.spreadsheet_id;
      campaign.sheetName = sheet.sheet_name;
      try {
        ctx.campaignStore.save(campaign);
      } catch (error) {
        ctx.pendingSheets.set(requestId, sheet);
        throw error;
      }
      ctx.campaigns.push(campaign.config);
      ctx.operator.selectedCampaignId = campaign.config.id;
      ctx.operator.selectedLeadId = null;
      await activateCampaignSheet(ctx, campaign.config.id);
      return reply.code(201).send(toPublicCampaign(campaign.config, ctx));
    } catch (error) {
      return reply.code(generationStatus(error)).send({ error: generationError(error) });
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
      return reply.code(generationStatus(error)).send({ error: generationError(error) });
    } finally {
      generating.delete(id);
    }
  });

  app.post("/api/campaigns/:id/leads/:leadId/prepare", { preHandler: auth }, async (request, reply) => {
    const { id, leadId } = request.params as { id: string; leadId: string };
    const parsed = z.object({ force: z.boolean().default(false) }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid preparation request" });
    if (ctx.shuttingDown) return reply.code(503).send({ error: "Server is restarting. Try again shortly." });
    const campaign = ctx.campaignStore.get(id);
    if (!campaign) return reply.code(404).send({ error: "AI campaign not found" });
    if (!ctx.llmClient) return reply.code(503).send({ error: "Configure the LLM connection to prepare this call." });
    await activateCampaignSheet(ctx, id);
    const lead = await ctx.adapter?.findLeadById(leadId);
    if (!lead) return reply.code(404).send({ error: "Lead is not eligible" });
    try {
      const preparation = await ctx.preparation.prepare(campaign, toPublicLead(lead), parsed.data.force);
      if (ctx.campaignStore.get(id)?.config.version !== campaign.config.version) {
        return reply.code(409).send({ error: "Campaign changed while preparing. Refresh and try again." });
      }
      return preparation;
    } catch (error) {
      return reply.code(502).send({ error: generationError(error) });
    }
  });
}
