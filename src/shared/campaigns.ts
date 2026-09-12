import { z } from "zod";
import { campaignTypeSchema } from "./schemas.js";

export function isPublicWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password &&
      host.includes(".") && !host.endsWith(".local") && !host.endsWith(".localhost") &&
      !host.endsWith(".internal") && !/^[\d.]+$/.test(host) && !host.includes(":");
  } catch {
    return false;
  }
}

const webUrl = z.string().max(2000).refine(isPublicWebUrl, "Use a public http(s) website URL");
const text = z.string().trim().min(1);
const identifier = text.max(80).regex(/^[a-z][a-z0-9_]*$/);

export const campaignBriefSchema = z.object({
  offeringName: text.max(160),
  offeringDescription: text.max(6000),
  targetCustomer: text.max(2000),
  objective: text.max(2000),
  type: campaignTypeSchema.default("sales"),
  website: z.union([webUrl, z.literal("")]).default(""),
  approvedFacts: z.array(text.max(1200)).max(30).default([]),
  // Optional mapping to an existing CRM tag. It never grants permission to write that column.
  sheetCampaignValue: z.string().trim().max(160).default("")
});

export const campaignInterviewTurnSchema = z.object({
  message: text.max(2000),
  ready: z.boolean(),
  brief: campaignBriefSchema.nullable()
}).superRefine((value, ctx) => {
  if (value.ready && value.brief === null) {
    ctx.addIssue({ code: "custom", path: ["brief"], message: "Ready turns must include a campaign brief" });
  }
});


export const discoveryQuestionSchema = z.object({
  id: identifier,
  prompt: text.max(350),
  purpose: text.max(400),
  required: z.boolean()
});

const objections = z.array(z.object({
  objection: text.max(250),
  response: text.max(600)
})).max(8);

export const campaignStrategySchema = z.object({
  name: text.max(160),
  positioning: text.max(1500),
  opening: text.max(800),
  questions: z.array(discoveryQuestionSchema).min(3).max(10),
  criteria: z.array(z.object({
    id: identifier,
    prompt: text.max(350),
    required: z.boolean(),
    onNo: z.enum(["disqualified", "defer", "unknown"])
  })).min(1).max(8),
  disqualifiers: z.array(text.max(250)).min(1).max(8),
  objections,
  nextStep: text.max(600),
  successOutcomes: z.array(z.enum(["meeting_booked", "permission_to_follow_up", "reference_received", "callback_later"])).min(1).max(4)
}).superRefine((value, ctx) => {
  for (const key of ["questions", "criteria"] as const) {
    if (new Set(value[key].map(item => item.id)).size !== value[key].length) {
      ctx.addIssue({ code: "custom", path: [key], message: "IDs must be unique" });
    }
  }
  if (!value.criteria.some(item => item.required)) {
    ctx.addIssue({ code: "custom", path: ["criteria"], message: "At least one qualification criterion must be required" });
  }
});

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
export type CampaignInterviewTurn = z.infer<typeof campaignInterviewTurnSchema>;
export type CampaignStrategy = z.infer<typeof campaignStrategySchema>;

export const researchSourceSchema = z.object({
  id: text.max(80),
  title: text.max(500),
  url: webUrl
});
export type ResearchSource = z.infer<typeof researchSourceSchema>;

const sourcedFact = z.object({
  text: text.max(700),
  sourceIds: z.array(text.max(80)).min(1).max(5)
});

export const prospectBriefSchema = z.object({
  company: z.array(sourcedFact).max(6),
  prospect: z.array(sourcedFact).max(6),
  hypotheses: z.array(text.max(500)).max(6),
  unknowns: z.array(text.max(400)).max(8),
  relevance: text.max(1000),
  opening: text.max(800),
  questions: z.array(discoveryQuestionSchema).min(3).max(10),
  objections,
  nextStep: text.max(600)
}).superRefine((value, ctx) => {
  if (new Set(value.questions.map(item => item.id)).size !== value.questions.length) {
    ctx.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique" });
  }
});

export const preparationSchema = z.object({
  id: text,
  campaignId: text,
  campaignVersion: z.number().int().positive(),
  leadId: text,
  inputHash: text,
  generatedAt: z.iso.datetime(),
  research: z.object({
    status: z.enum(["complete", "unavailable", "no_sources"]),
    searchedAt: z.iso.datetime(),
    sources: z.array(researchSourceSchema).max(30),
    warnings: z.array(z.string())
  }),
  brief: prospectBriefSchema
});
export type ProspectPreparation = z.infer<typeof preparationSchema>;

export type CampaignLead = {
  leadId: string;
  fullName: string;
  company: string;
  role: string;
  sheetCampaign: string;
  assigned: boolean;
};
