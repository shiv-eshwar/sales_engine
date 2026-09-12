import { z } from "zod";
import {
  campaignInterviewTurnSchema,
  type CampaignBrief
} from "../../shared/campaigns.js";
import type { LlmClient } from "../llm/types.js";
import { renderAgentSystem } from "../agents/loader.js";
import type { ManagedCampaign } from "./store.js";

export type InterviewMessage = { role: "user" | "assistant" | "system"; content: string };

export async function interviewCampaignTurn(
  llm: LlmClient,
  messages: InterviewMessage[],
  timeoutMs: number,
  previous?: ManagedCampaign
): Promise<{ message: string; brief: CampaignBrief | null }> {
  const raw = await llm.completeJson({
    system: renderAgentSystem("campaign-interview", JSON.stringify(z.toJSONSchema(campaignInterviewTurnSchema))),
    user: JSON.stringify({
      conversation: messages,
      existingOffering: previous ? { name: previous.config.name, brief: previous.brief } : null
    }),
    timeoutMs
  });
  const parsed = campaignInterviewTurnSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("AI generation failed or returned an invalid result. Check the AI connection and try again; your saved campaign is unchanged.");
  }
  if (!parsed.data.ready || !parsed.data.brief) {
    return { message: parsed.data.message, brief: null };
  }
  return { message: parsed.data.message, brief: parsed.data.brief };
}
