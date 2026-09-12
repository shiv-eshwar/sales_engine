import type { BootstrapResponse, PublicLead } from "../../shared/contracts.js";
import type { AppContext } from "../context.js";
import type { LeadRecord } from "../../shared/types.js";
import { skippedLeadKey } from "../campaigns/store.js";
import { activateCampaignSheet, withSheetBinding } from "../sheets/bind.js";

export function toPublicLead(lead: LeadRecord): PublicLead {
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

export async function loadNextLead(ctx: AppContext): Promise<{
  lead: PublicLead | null;
  leads: PublicLead[];
  diagnostics: BootstrapResponse["sheet"]["diagnostics"];
  sheetStatus: BootstrapResponse["sheet"];
}> {
  await activateCampaignSheet(ctx, ctx.operator.selectedCampaignId);
  if (!ctx.adapter) {
    ctx.operator.selectedLeadId = null;
    return {
      lead: null,
      leads: [],
      diagnostics: [],
      sheetStatus: withSheetBinding(ctx, {
        status: "unconfigured",
        message: ctx.sheetMessage || "Google Sheets is not configured",
        diagnostics: []
      })
    };
  }

  const preflight = await ctx.adapter.preflight();
  if (!preflight.ok) {
    ctx.operator.selectedLeadId = null;
    return {
      lead: null,
      leads: [],
      diagnostics: [],
      sheetStatus: withSheetBinding(ctx, {
        status: "error",
        message: preflight.errors.join(" "),
        diagnostics: preflight.errors.map((message) => ({
          code: message.includes("more than once") ? "duplicate_header" : "missing_header",
          message
        }))
      })
    };
  }

  const queue = await ctx.adapter.loadQueue();
  const campaignId = ctx.operator.selectedCampaignId;
  const belongs = campaignId ? ctx.campaignStore.membership(campaignId) : () => false;
  const available = queue.leads.filter((lead) => belongs(lead) && !ctx.operator.skippedLeadIds.has(skippedLeadKey(campaignId, lead.leadId)));
  const leads = available.map(toPublicLead);

  // Keep an explicitly selected lead active as long as it is still eligible.
  // Otherwise fall back to the head of the queue so Skip/Reload keep working.
  let lead: LeadRecord | null = null;
  if (ctx.operator.selectedLeadId) {
    lead = available.find((item) => item.leadId === ctx.operator.selectedLeadId) ?? null;
    if (!lead) {
      ctx.operator.selectedLeadId = null;
    }
  }
  lead ??= available[0] ?? null;
  if (lead) {
    ctx.operator.selectedLeadId = lead.leadId;
  } else {
    ctx.operator.selectedLeadId = null;
  }

  return {
    lead: lead ? toPublicLead(lead) : null,
    leads,
    diagnostics: queue.diagnostics,
    sheetStatus: withSheetBinding(ctx, {
      status: "ok",
      message: lead ? "Sheet connected" : campaignId ? "No eligible contacts in the connected Sheet" : "Create a campaign to start calling",
      diagnostics: queue.diagnostics
    })
  };
}
