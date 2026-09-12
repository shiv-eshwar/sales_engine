import { describe, expect, it } from "vitest";
import { z } from "zod";
import { renderAgentSystem, type AgentName } from "../../src/server/agents/loader.js";
import liveCoachAgent from "../../agents/live-coach/agent.js";
import postCallAgent from "../../agents/post-call/agent.js";
import campaignAgent from "../../agents/campaign-generation/agent.js";
import interviewAgent from "../../agents/campaign-interview/agent.js";
import researchAgent from "../../agents/prospect-research/agent.js";
import { liveCoachOutputSchema } from "../../src/server/coach/schema.js";
import { postCallOutcomeSchema } from "../../src/shared/schemas.js";
import { campaignInterviewTurnSchema, campaignStrategySchema, prospectBriefSchema } from "../../src/shared/campaigns.js";

const agents: AgentName[] = ["live-coach", "post-call", "campaign-generation", "campaign-interview", "prospect-research"];

describe("eve agent instructions", () => {
  it("renders every agent with its schema slotted in and no placeholder left", () => {
    for (const name of agents) {
      const system = renderAgentSystem(name, "SCHEMA-LINE");
      expect(system).toContain("SCHEMA-LINE");
      expect(system).not.toContain("{{SCHEMA}}");
      expect(system.length).toBeGreaterThan(200);
    }
  });

  it("keeps the live-coach and post-call systems on one line", () => {
    expect(renderAgentSystem("live-coach", "S")).not.toContain("\n");
    expect(renderAgentSystem("post-call", "S")).not.toContain("\n");
  });

  it("keeps multi-line systems for generation agents", () => {
    expect(renderAgentSystem("campaign-generation", "S")).toContain("\n");
    expect(renderAgentSystem("campaign-interview", "S")).toContain("\n");
    expect(renderAgentSystem("prospect-research", "S")).toContain("\n");
  });

  it("preserves the exact legacy instruction text", () => {
    expect(renderAgentSystem("live-coach", "S")).toContain(
      "You are a live call coach for one human operator. Return JSON only matching LiveCoachOutput."
    );
    expect(renderAgentSystem("live-coach", "S")).toContain("Problem Proposition");
    expect(renderAgentSystem("live-coach", "S")).toContain("never rebut or pitch");
    expect(renderAgentSystem("post-call", "S")).toContain(
      "You extract one structured post-call CRM proposal. Return JSON only matching PostCallOutcome."
    );
    expect(renderAgentSystem("post-call", "S")).toContain("send_information");
    expect(renderAgentSystem("campaign-generation", "S")).toContain(
      "Create a campaign strategy for exactly the offering supplied. Return JSON matching this schema:"
    );
    expect(renderAgentSystem("campaign-interview", "S")).toContain(
      "You interview one human operator to collect a campaign offering brief. Return JSON matching this schema:"
    );
    expect(renderAgentSystem("prospect-research", "S")).toContain(
      "Prepare one human-led call for this campaign and prospect. Return JSON matching this schema:"
    );
    for (const name of ["live-coach", "post-call"] as const) {
      expect(renderAgentSystem(name, "S")).toContain("Never invent customer names, results, prices, integrations, guarantees, or unapproved claims.");
    }
    for (const name of ["campaign-generation", "prospect-research"] as const) {
      expect(renderAgentSystem(name, "S")).toContain("Use SPIN as a flexible discovery framework");
    }
  });
});

describe("eve agent definitions", () => {
  it("declares a description, model, and the exact output contract", () => {
    const cases = [
      { agent: liveCoachAgent, schema: liveCoachOutputSchema },
      { agent: postCallAgent, schema: postCallOutcomeSchema },
      { agent: campaignAgent, schema: campaignStrategySchema },
      { agent: interviewAgent, schema: campaignInterviewTurnSchema },
      { agent: researchAgent, schema: prospectBriefSchema }
    ];
    for (const { agent, schema } of cases) {
      expect(agent.description.length).toBeGreaterThan(10);
      expect(agent.model.length).toBeGreaterThan(0);
      expect(agent.outputSchema).toBe(schema);
      expect(() => z.toJSONSchema(schema)).not.toThrow();
    }
  });
});
