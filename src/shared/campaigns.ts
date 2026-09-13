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


function discoveryQuestionSchema(promptMax: number, purposeMax: number) {
  return z.object({
    id: identifier,
    prompt: text.max(promptMax),
    purpose: text.max(purposeMax),
    required: z.boolean()
  });
}

function objectionList(count: number, objectionMax: number, responseMax: number) {
  return z.array(z.object({
    objection: text.max(objectionMax),
    response: text.max(responseMax)
  })).max(count);
}

const strategyCriteria = z.array(z.object({
  id: identifier,
  prompt: text.max(350),
  required: z.boolean(),
  onNo: z.enum(["disqualified", "defer", "unknown"])
})).min(1).max(8);

function campaignStrategyShape(options: {
  openingMax: number;
  questionPromptMax: number;
  questionPurposeMax: number;
  questionMax: number;
  objections: ReturnType<typeof objectionList>;
  nextStepMax: number;
}) {
  return z.object({
    name: text.max(160),
    positioning: text.max(1500),
    opening: text.max(options.openingMax),
    questions: z.array(discoveryQuestionSchema(options.questionPromptMax, options.questionPurposeMax)).min(3).max(options.questionMax),
    criteria: strategyCriteria,
    disqualifiers: z.array(text.max(250)).min(1).max(8),
    objections: options.objections,
    nextStep: text.max(options.nextStepMax),
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
}

// Tight contract for newly generated LLM output. Stored rows use the record schema
// so older longer openings/question lists still load.
export const campaignStrategySchema = campaignStrategyShape({
  openingMax: 280,
  questionPromptMax: 140,
  questionPurposeMax: 80,
  questionMax: 4,
  objections: objectionList(3, 80, 140),
  nextStepMax: 140
});

export const campaignStrategyRecordSchema = campaignStrategyShape({
  openingMax: 800,
  questionPromptMax: 350,
  questionPurposeMax: 400,
  questionMax: 10,
  objections: objectionList(8, 250, 600),
  nextStepMax: 600
});

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
export type CampaignInterviewTurn = z.infer<typeof campaignInterviewTurnSchema>;
export type CampaignStrategy = z.infer<typeof campaignStrategyRecordSchema>;

export const researchSourceSchema = z.object({
  id: text.max(80),
  title: text.max(500),
  url: webUrl
});
export type ResearchSource = z.infer<typeof researchSourceSchema>;

function sourcedFact(textMax: number) {
  return z.object({
    text: text.max(textMax),
    sourceIds: z.array(text.max(80)).min(1).max(5)
  });
}

function prospectBriefShape(options: {
  factMax: number;
  factTextMax: number;
  hypothesisMax: number;
  hypothesisCount: number;
  unknownMax: number;
  unknownCount: number;
  relevanceMax: number;
  openingMax: number;
  questionMin: number;
  questionMax: number;
  questionPromptMax: number;
  questionPurposeMax: number;
  objections: ReturnType<typeof objectionList>;
  nextStepMax: number;
}) {
  return z.object({
    company: z.array(sourcedFact(options.factTextMax)).max(options.factMax),
    prospect: z.array(sourcedFact(options.factTextMax)).max(options.factMax),
    hypotheses: z.array(text.max(options.hypothesisMax)).max(options.hypothesisCount),
    unknowns: z.array(text.max(options.unknownMax)).max(options.unknownCount),
    relevance: text.max(options.relevanceMax),
    opening: text.max(options.openingMax),
    questions: z.array(discoveryQuestionSchema(options.questionPromptMax, options.questionPurposeMax)).min(options.questionMin).max(options.questionMax),
    objections: options.objections,
    nextStep: text.max(options.nextStepMax)
  }).superRefine((value, ctx) => {
    if (new Set(value.questions.map(item => item.id)).size !== value.questions.length) {
      ctx.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique" });
    }
  });
}

export const prospectBriefSchema = prospectBriefShape({
  factMax: 3,
  factTextMax: 180,
  hypothesisMax: 140,
  hypothesisCount: 3,
  unknownMax: 100,
  unknownCount: 4,
  relevanceMax: 220,
  openingMax: 280,
  questionMin: 2,
  questionMax: 4,
  questionPromptMax: 140,
  questionPurposeMax: 80,
  objections: objectionList(3, 80, 140),
  nextStepMax: 140
});

export const prospectBriefRecordSchema = prospectBriefShape({
  factMax: 6,
  factTextMax: 700,
  hypothesisMax: 500,
  hypothesisCount: 6,
  unknownMax: 400,
  unknownCount: 8,
  relevanceMax: 1000,
  openingMax: 800,
  questionMin: 2,
  questionMax: 10,
  questionPromptMax: 350,
  questionPurposeMax: 400,
  objections: objectionList(8, 250, 600),
  nextStepMax: 600
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
  brief: prospectBriefRecordSchema
});
export type ProspectPreparation = z.infer<typeof preparationSchema>;
