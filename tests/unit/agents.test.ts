import { describe, expect, it } from "vitest";
import { z } from "zod";
import { listAgentSkills, renderAgentSystem, type AgentName } from "../../src/server/agents/loader.js";
import liveCoachAgent from "../../agents/live-coach/agent.js";
import postCallAgent from "../../agents/post-call/agent.js";
import campaignAgent from "../../agents/campaign-generation/agent.js";
import interviewAgent from "../../agents/campaign-interview/agent.js";
import researchAgent from "../../agents/prospect-research/agent.js";
import reviewAgent from "../../agents/call-review/agent.js";
import { liveCoachOutputSchema } from "../../src/server/coach/schema.js";
import { postCallOutcomeSchema, reviewInterviewTurnSchema } from "../../src/shared/schemas.js";
import { campaignInterviewTurnSchema, campaignStrategySchema, prospectBriefSchema } from "../../src/shared/campaigns.js";

const agents: AgentName[] = ["live-coach", "post-call", "campaign-generation", "campaign-interview", "prospect-research", "call-review"];

const skillMap: Record<AgentName, string[]> = {
  "live-coach": ["blount-fanatical-prospecting", "farrokh-cold-calling-sucks"],
  "post-call": ["blount-fanatical-prospecting", "sobczak-smart-calling"],
  "campaign-generation": ["sobczak-smart-calling", "weinberg-new-sales-simplified"],
  "campaign-interview": ["weinberg-new-sales-simplified"],
  "prospect-research": ["farrokh-cold-calling-sucks", "sobczak-smart-calling"],
  "call-review": []
};

describe("eve agent instructions", () => {
  it("renders every agent with its schema slotted in and no placeholder left", () => {
    for (const name of agents) {
      const system = renderAgentSystem(name, "SCHEMA-LINE");
      expect(system).toContain("SCHEMA-LINE");
      expect(system).not.toContain("{{SCHEMA}}");
      expect(system.length).toBeGreaterThan(200);
    }
  });

  it("keeps identity, stakes, and the output contract", () => {
    expect(renderAgentSystem("live-coach", "S")).toContain("in-ear coach");
    expect(renderAgentSystem("live-coach", "S")).toContain("400 characters");
    expect(renderAgentSystem("post-call", "S")).toContain("forensic CRM extractor");
    expect(renderAgentSystem("campaign-generation", "S")).toContain("campaign architect");
    expect(renderAgentSystem("campaign-interview", "S")).toContain("You do not generate strategy");
    expect(renderAgentSystem("prospect-research", "S")).toContain("pre-call strategist");
    expect(renderAgentSystem("prospect-research", "S")).toContain("one breath");
    expect(renderAgentSystem("prospect-research", "S")).toContain("lastTouch");
    expect(renderAgentSystem("live-coach", "S")).toContain("lastTouch");
    expect(renderAgentSystem("call-review", "S")).toContain("post-call review partner");
    for (const name of ["live-coach", "post-call"] as const) {
      expect(renderAgentSystem(name, "S")).toContain("Never invent customer names, results, prices, integrations, guarantees, or unapproved claims.");
    }
  });

  it("scopes skills to each agent and preloads cheatsheets without chapters or SKILL.md dumps", () => {
    for (const name of agents) {
      const packs = listAgentSkills(name).map((pack) => pack.name).sort();
      expect(packs).toEqual(skillMap[name]);
      const system = renderAgentSystem(name, "S");
      expect(system).not.toContain("chapters/");
      expect(system).not.toContain("This skill covers the book content only");
      expect(system).not.toContain("Covers Sobczak’s Smart Calling process only");
      if (packs.length) {
        expect(system).toContain("Available skills");
        expect(system).toContain("Loaded procedures");
        for (const pack of packs) expect(system).toContain(pack);
      } else {
        expect(system).not.toContain("Available skills");
      }
    }
    expect(renderAgentSystem("live-coach", "S")).not.toContain("weinberg-new-sales-simplified");
    expect(renderAgentSystem("live-coach", "S")).not.toContain("sobczak-smart-calling");
    expect(renderAgentSystem("prospect-research", "S")).not.toContain("blount-fanatical-prospecting");
    expect(renderAgentSystem("campaign-generation", "S")).not.toContain("farrokh-cold-calling-sucks");
    expect(renderAgentSystem("post-call", "S")).not.toContain("farrokh-cold-calling-sucks");
    expect(renderAgentSystem("campaign-interview", "S")).not.toContain("farrokh-cold-calling-sucks");
  });
});

describe("eve agent definitions", () => {
  it("declares a description, model, and the exact output contract", () => {
    const cases = [
      { agent: liveCoachAgent, schema: liveCoachOutputSchema },
      { agent: postCallAgent, schema: postCallOutcomeSchema },
      { agent: campaignAgent, schema: campaignStrategySchema },
      { agent: interviewAgent, schema: campaignInterviewTurnSchema },
      { agent: researchAgent, schema: prospectBriefSchema },
      { agent: reviewAgent, schema: reviewInterviewTurnSchema }
    ];
    for (const { agent, schema } of cases) {
      expect(agent.description.length).toBeGreaterThan(10);
      expect(agent.model.length).toBeGreaterThan(0);
      expect(agent.outputSchema).toBe(schema);
      expect(() => z.toJSONSchema(schema)).not.toThrow();
    }
  });
});
