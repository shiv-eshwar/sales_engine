import type { FastifyInstance } from "fastify";
import type { BootstrapResponse, PublicCampaign, PublicLead } from "../../shared/contracts.js";
import { refreshLeadRequestSchema, skipLeadRequestSchema } from "../../shared/schemas.js";
import type { AppContext } from "../context.js";
import { requireSession } from "../auth/routes.js";
import type { LeadRecord } from "../../shared/types.js";

function toPublicCampaign(campaign: AppContext["campaigns"][number]): PublicCampaign {
  return {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    version: campaign.version,
    objective: campaign.objective,
    requiredQuestions: campaign.required_questions
  };
}

function toPublicLead(lead: LeadRecord): PublicLead {
  return {
    leadId: lead.leadId,
    fullName: lead.fullName,
    phone: lead.phone,
    phoneE164: lead.phoneE164,
    dialable: lead.dialable,
    company: lead.company,
    role: lead.role,
    enrichment: lead.enrichment,
    campaignId: lead.campaignId,
    crmStatus: lead.crmStatus,
    callStatus: lead.callStatus,
    issues: lead.issues
  };
}

async function nextLead(ctx: AppContext): Promise<{
  lead: PublicLead | null;
  diagnostics: BootstrapResponse["sheet"]["diagnostics"];
  sheetStatus: BootstrapResponse["sheet"];
}> {
  if (!ctx.adapter) {
    return {
      lead: null,
      diagnostics: [],
      sheetStatus: {
        status: "unconfigured",
        message: ctx.sheetMessage || "Google Sheets is not configured",
        diagnostics: []
      }
    };
  }

  const preflight = await ctx.adapter.preflight();
  if (!preflight.ok) {
    return {
      lead: null,
      diagnostics: [],
      sheetStatus: {
        status: "error",
        message: preflight.errors.join(" "),
        diagnostics: preflight.errors.map((message) => ({
          code: message.includes("more than once") ? "duplicate_header" : "missing_header",
          message
        }))
      }
    };
  }

  const queue = await ctx.adapter.loadQueue();
  const available = queue.leads.filter((lead) => !ctx.operator.skippedLeadIds.has(lead.leadId));
  const lead = available[0] ?? null;

  return {
    lead: lead ? toPublicLead(lead) : null,
    diagnostics: queue.diagnostics,
    sheetStatus: {
      status: "ok",
      message: lead ? "Sheet connected" : "No eligible leads",
      diagnostics: queue.diagnostics
    }
  };
}

export async function registerLeads(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };

  app.get("/api/bootstrap", { preHandler: auth }, async () => {
    if (ctx.campaigns[0] && !ctx.operator.selectedCampaignId) {
      ctx.operator.selectedCampaignId = ctx.campaigns[0].id;
    }
    const next = await nextLead(ctx);
    const body: BootstrapResponse = {
      campaigns: ctx.campaigns.map(toPublicCampaign),
      selectedCampaignId: ctx.operator.selectedCampaignId,
      sheet: next.sheetStatus,
      twilio: { status: "not_configured", message: "Twilio device is not wired until Slice 2" },
      lead: next.lead
    };
    return body;
  });

  app.get("/api/leads/next", { preHandler: auth }, async () => {
    const next = await nextLead(ctx);
    return { lead: next.lead, sheet: next.sheetStatus };
  });

  app.post("/api/leads/skip", { preHandler: auth }, async (request, reply) => {
    const parsed = skipLeadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "leadId is required" });
    }
    if (parsed.data.campaignId) {
      ctx.operator.selectedCampaignId = parsed.data.campaignId;
    }
    ctx.operator.skippedLeadIds.add(parsed.data.leadId);
    const next = await nextLead(ctx);
    return { lead: next.lead, sheet: next.sheetStatus };
  });

  app.post("/api/leads/refresh", { preHandler: auth }, async (request) => {
    const parsed = refreshLeadRequestSchema.safeParse(request.body ?? {});
    if (parsed.success && parsed.data.campaignId) {
      ctx.operator.selectedCampaignId = parsed.data.campaignId;
    }
    const next = await nextLead(ctx);
    return { lead: next.lead, sheet: next.sheetStatus };
  });

  app.post("/api/campaigns/select", { preHandler: auth }, async (request, reply) => {
    const body = request.body as { campaignId?: string };
    if (!body.campaignId || !ctx.campaigns.some((campaign) => campaign.id === body.campaignId)) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    ctx.operator.selectedCampaignId = body.campaignId;
    const next = await nextLead(ctx);
    return { selectedCampaignId: body.campaignId, lead: next.lead, sheet: next.sheetStatus };
  });
}
