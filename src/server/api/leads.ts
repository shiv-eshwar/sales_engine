import type { FastifyInstance } from "fastify";
import type { BootstrapResponse, PublicCampaign } from "../../shared/contracts.js";
import { refreshLeadRequestSchema, skipLeadRequestSchema } from "../../shared/schemas.js";
import type { AppContext } from "../context.js";
import { twilioVoiceConfigured } from "../twilio/config.js";
import { requireSession } from "../auth/routes.js";
import { loadNextLead } from "../leads/nextLead.js";
import { findPendingProposal } from "../review/store.js";
import { buildDailySummary } from "../review/summary.js";
import { skippedLeadKey } from "../campaigns/store.js";

export function toPublicCampaign(campaign: AppContext["campaigns"][number], ctx: AppContext): PublicCampaign {
  const managed = ctx.campaignStore.get(campaign.id);
  return {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    version: campaign.version,
    objective: campaign.objective,
    requiredQuestions: campaign.required_questions,
    ...(managed ? { brief: managed.brief, strategy: managed.strategy } : {})
  };
}

function pendingProposal(ctx: AppContext): BootstrapResponse["pendingProposal"] {
  if (!ctx.finalizer) {
    return null;
  }
  const row = findPendingProposal(ctx.db);
  if (!row || row.status === "processing") {
    return null;
  }
  try {
    return ctx.finalizer.present(row);
  } catch {
    return null;
  }
}

export async function registerLeads(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };

  app.get("/api/bootstrap", { preHandler: auth }, async () => {
    if (ctx.campaigns[0] && !ctx.operator.selectedCampaignId) {
      ctx.operator.selectedCampaignId = ctx.campaigns[0].id;
    }
    const next = await loadNextLead(ctx);
    const twilioOk = twilioVoiceConfigured(ctx.env);
    const body: BootstrapResponse = {
      campaigns: ctx.campaigns.map(campaign => toPublicCampaign(campaign, ctx)),
      selectedCampaignId: ctx.operator.selectedCampaignId,
      sheet: next.sheetStatus,
      twilio: twilioOk
        ? { status: "ok", message: "Twilio Voice is configured. Register the device in the browser." }
        : { status: "not_configured", message: "Twilio Voice is not configured" },
      ai: ctx.llmClient
        ? { status: "ok", message: "AI generation configured" }
        : { status: "not_configured", message: "Configure LLM_BASE_URL, LLM_API_KEY and LLM_MODEL to generate campaigns." },
      research: ctx.researchClient
        ? { status: "ok", message: "Web research configured" }
        : { status: "not_configured", message: "Web research unavailable; preparation will use CRM context only." },
      lead: next.lead,
      recordingNotice: ctx.env.RECORDING_NOTICE,
      pendingProposal: pendingProposal(ctx),
      summary: buildDailySummary(ctx.db, ctx.playbook, ctx.campaigns)
    };
    return body;
  });

  app.get("/api/leads/next", { preHandler: auth }, async () => {
    const next = await loadNextLead(ctx);
    return { lead: next.lead, sheet: next.sheetStatus };
  });

  app.post("/api/leads/skip", { preHandler: auth }, async (request, reply) => {
    const parsed = skipLeadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "leadId is required" });
    }
    if (parsed.data.campaignId) {
      if (!ctx.campaigns.some(c => c.id === parsed.data.campaignId)) return reply.code(400).send({ error: "Unknown campaign" });
      ctx.operator.selectedCampaignId = parsed.data.campaignId;
    }
    ctx.operator.skippedLeadIds.add(skippedLeadKey(ctx.operator.selectedCampaignId, parsed.data.leadId));
    const next = await loadNextLead(ctx);
    return { lead: next.lead, sheet: next.sheetStatus };
  });

  app.post("/api/leads/refresh", { preHandler: auth }, async (request, reply) => {
    const parsed = refreshLeadRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid campaign selection" });
    if (parsed.data.campaignId) {
      if (!ctx.campaigns.some(c => c.id === parsed.data.campaignId)) return reply.code(400).send({ error: "Unknown campaign" });
      ctx.operator.selectedCampaignId = parsed.data.campaignId;
    }
    const next = await loadNextLead(ctx);
    return { lead: next.lead, sheet: next.sheetStatus };
  });

  app.post("/api/campaigns/select", { preHandler: auth }, async (request, reply) => {
    const body = request.body as { campaignId?: string };
    if (!body.campaignId || !ctx.campaigns.some((campaign) => campaign.id === body.campaignId)) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    ctx.operator.selectedCampaignId = body.campaignId;
    const next = await loadNextLead(ctx);
    return { selectedCampaignId: body.campaignId, lead: next.lead, sheet: next.sheetStatus };
  });
}
