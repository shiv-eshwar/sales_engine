import type { CampaignBrief, CampaignStrategy } from "../../src/shared/campaigns.js";
import type { ResearchClient } from "../../src/server/research/client.js";

export function offering(name = "Invoice assistant"): CampaignBrief {
  return {
    offeringName: name,
    offeringDescription: `${name} helps finance teams organize unpaid invoices.`,
    targetCustomer: "Finance leaders at small service businesses",
    objective: "Understand collections workflow and agree on a relevant follow-up",
    type: "sales", website: "https://example.com", approvedFacts: ["Shows unpaid invoices in one place."], sheetCampaignValue: ""
  };
}

export function strategy(name = "Invoice discovery"): CampaignStrategy {
  return {
    name, positioning: "Explore whether organizing unpaid invoices would help this finance team.",
    opening: "Could I ask a quick question about your invoice follow-up process?",
    questions: [
      { id: "workflow", prompt: "How do you handle unpaid invoices today?", purpose: "Understand the workflow", required: true },
      { id: "impact", prompt: "What happens when an invoice stays unpaid?", purpose: "Explore impact without assuming it", required: true },
      { id: "decision", prompt: "Who helps evaluate changes to that process?", purpose: "Understand decisions", required: false }
    ],
    criteria: [{ id: "invoice_pain", prompt: "Is following up on unpaid invoices a relevant problem?", required: true, onNo: "disqualified" }],
    disqualifiers: ["No unpaid-invoice problem"],
    objections: [{ objection: "We already use accounting software", response: "Understood. How does it handle follow-up today?" }],
    nextStep: "If there is interest, agree on a workflow review.", successOutcomes: ["permission_to_follow_up"]
  };
}

export function prospectBrief(sourced = true) {
  const base = strategy();
  return {
    company: sourced ? [{ text: "Northwind QA describes its business as software services.", sourceIds: ["source_1"] }] : [],
    prospect: [], hypotheses: ["Invoice follow-up might take time; validate this in discovery."],
    unknowns: ["No public evidence of budget or buying authority."],
    relevance: "Explore whether the finance workflow has an unpaid-invoice problem.",
    opening: "Alex, could I ask how Northwind QA handles invoice follow-up?",
    questions: base.questions, objections: base.objections, nextStep: base.nextStep
  };
}

export const fakeResearch: ResearchClient = {
  async research() {
    return {
      report: "Northwind QA describes itself as a software services business (https://example.com/company).",
      sources: [{ id: "source_1", title: "Northwind QA company page", url: "https://example.com/company" }],
      searchedAt: new Date().toISOString()
    };
  }
};
