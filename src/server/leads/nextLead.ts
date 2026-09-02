import type { BootstrapResponse, PublicLead } from "../../shared/contracts.js";
import type { AppContext } from "../context.js";
import type { LeadRecord } from "../../shared/types.js";

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
