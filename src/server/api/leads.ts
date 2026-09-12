import type { FastifyInstance } from "fastify";
import type { BootstrapResponse, PublicCampaign } from "../../shared/contracts.js";
import { refreshLeadRequestSchema, selectLeadRequestSchema, skipLeadRequestSchema } from "../../shared/schemas.js";
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
    openingContext: campaign.opening_context,
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

function applyCampaignSelection(ctx: AppContext, campaignId: string | undefined): boolean {
  if (!campaignId) {
    return true;
  }
  if (!ctx.campaigns.some(c => c.id === campaignId)) {
    return false;
  }
  if (ctx.operator.selectedCampaignId !== campaignId) {
    ctx.operator.selectedCampaignId = campaignId;
    // A newly selected campaign starts at the head of its own queue.
    ctx.operator.selectedLeadId = null;
  }
  return true;
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
        ? {
            status: "ok",
            message: "Twilio Voice is configured. Register the device in the browser.",
            callerId: ctx.env.TWILIO_CALLER_ID ?? null
          }
        : { status: "not_configured", message: "Twilio Voice is not configured", callerId: null },
      ai: ctx.llmClient
        ? { status: "ok", message: "AI generation configured" }
        : { status: "not_configured", message: "AI is not connected — ask whoever runs this box to finish setup." },
      research: ctx.researchClient
        ? { status: "ok", message: "Web research configured" }
        : { status: "not_configured", message: "Web research unavailable; preparation will use CRM context only." },
      lead: next.lead,
      leads: next.leads,
      recordingNotice: ctx.env.RECORDING_NOTICE,
      pendingProposal: pendingProposal(ctx),
      summary: buildDailySummary(ctx.db, ctx.playbook, ctx.campaigns)
    };
    return body;
  });

  app.get("/api/leads", { preHandler: auth }, async (request, reply) => {
    const campaignId = (request.query as { campaignId?: string } | undefined)?.campaignId;
    if (campaignId && !ctx.campaigns.some(c => c.id === campaignId)) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    if (campaignId) {
      ctx.operator.selectedCampaignId = campaignId;
      ctx.operator.selectedLeadId = null;
    }
    const next = await loadNextLead(ctx);
    return { lead: next.lead, leads: next.leads, sheet: next.sheetStatus };
  });

  app.get("/api/leads/next", { preHandler: auth }, async () => {
    const next = await loadNextLead(ctx);
    return { lead: next.lead, leads: next.leads, sheet: next.sheetStatus };
  });

  app.post("/api/leads/select", { preHandler: auth }, async (request, reply) => {
    const parsed = selectLeadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "leadId is required" });
    }
    if (!applyCampaignSelection(ctx, parsed.data.campaignId)) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    // Tentatively select, then let loadNextLead validate eligibility (skipped,
    // unassigned, ineligible, or missing). If the requested lead is not in the
    // returned queue the selection did not stick and the previous lead is kept.
    const previousLeadId = ctx.operator.selectedLeadId;
    ctx.operator.selectedLeadId = parsed.data.leadId;
    const next = await loadNextLead(ctx);
    if (!next.lead || next.lead.leadId !== parsed.data.leadId) {
      ctx.operator.selectedLeadId = previousLeadId;
      await loadNextLead(ctx);
      return reply.code(404).send({ error: "Lead is not eligible for this campaign" });
    }
    return { lead: next.lead, leads: next.leads, sheet: next.sheetStatus };
  });

  app.post("/api/leads/skip", { preHandler: auth }, async (request, reply) => {
    const parsed = skipLeadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "leadId is required" });
    }
    if (!applyCampaignSelection(ctx, parsed.data.campaignId)) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    ctx.operator.skippedLeadIds.add(skippedLeadKey(ctx.operator.selectedCampaignId, parsed.data.leadId));
    if (ctx.operator.selectedLeadId === parsed.data.leadId) {
      ctx.operator.selectedLeadId = null;
    }
    const next = await loadNextLead(ctx);
    return { lead: next.lead, leads: next.leads, sheet: next.sheetStatus };
  });

  app.post("/api/leads/refresh", { preHandler: auth }, async (request, reply) => {
    const parsed = refreshLeadRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid campaign selection" });
    if (!applyCampaignSelection(ctx, parsed.data.campaignId)) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    const next = await loadNextLead(ctx);
    return { lead: next.lead, leads: next.leads, sheet: next.sheetStatus };
  });

  app.post("/api/campaigns/select", { preHandler: auth }, async (request, reply) => {
    const body = request.body as { campaignId?: string };
    if (!body.campaignId || !ctx.campaigns.some((campaign) => campaign.id === body.campaignId)) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    ctx.operator.selectedCampaignId = body.campaignId;
    ctx.operator.selectedLeadId = null;
    const next = await loadNextLead(ctx);
    return { selectedCampaignId: body.campaignId, lead: next.lead, leads: next.leads, sheet: next.sheetStatus };
  });
}
