import { describe, expect, it } from "vitest";
import { liveCoachOutputSchema } from "../../src/server/coach/schema.js";
import { evidenceInContext } from "../../src/server/coach/evidence.js";
import { validateLiveCoachOutput } from "../../src/server/coach/validate.js";
import { loadCampaigns } from "../../src/server/config/campaigns.js";
import { loadPlaybook } from "../../src/server/config/playbook.js";
import type { LeadSnapshot } from "../../src/server/calls/ledger.js";
import type { PublicUtterance } from "../../src/server/transcript/utterances.js";

const snapshot: LeadSnapshot = {
  leadId: "L-100",
  fullName: "Ada Example",
  phone: "+14155550100",
  phoneE164: "+14155550100",
  company: "Example Co",
  role: "Founder"
};

const utterance: PublicUtterance = {
  id: "u1",
  sessionId: "s",
  speaker: "contact",
  text: "we already use an in-house checker",
  startedAtMs: 0,
  endedAtMs: 50,
  confidence: 1,
  isFinal: true,
  sequence: 1
};

function baseOutput(overrides: Record<string, unknown> = {}) {
  return {
    basedOnSequence: 1,
    stage: "objection",
    shouldShow: true,
    cueType: "clarify",
    cue: "What does that checker still miss?",
    reason: "existing solution",
    detectedObjection: "existing_solution",
    qualificationUpdates: [],
    recommendedOutcome: null,
    confidence: 0.8,
    ...overrides
  };
}

describe("Live-coach schema and validators", () => {
  const campaign = loadCampaigns("./config/campaigns").find((item) => item.id === "lamina-sales")!;
  const playbook = loadPlaybook("./config/playbooks/cold-calling.yaml");

  it("rejects oversized cues and unknown criteria", () => {
    expect(liveCoachOutputSchema.safeParse(baseOutput({ cue: "x".repeat(161) })).success).toBe(false);
    const parsed = liveCoachOutputSchema.parse(
      baseOutput({
        qualificationUpdates: [{ criterion: "made_up", state: "yes", evidence: "we already use an in-house checker", confidence: 0.9 }]
      })
    );
    const result = validateLiveCoachOutput(parsed, {
      campaign,
      playbook,
      utterances: [utterance],
      snapshot,
      firstObjection: true
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/unknown criterion/);
    }
  });

  it("rejects qualification evidence absent from transcript or CRM context", () => {
    expect(evidenceInContext("totally invented pain", [utterance], snapshot)).toBe(false);
    const parsed = liveCoachOutputSchema.parse(
      baseOutput({
        qualificationUpdates: [
          { criterion: "relevant_problem", state: "yes", evidence: "totally invented pain", confidence: 0.9 }
        ]
      })
    );
    const result = validateLiveCoachOutput(parsed, {
      campaign,
      playbook,
      utterances: [utterance],
      snapshot,
      firstObjection: true
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/evidence/);
    }
  });

  it("rejects a first-objection rebuttal", () => {
    const parsed = liveCoachOutputSchema.parse(
      baseOutput({
        cueType: "cta",
        cue: "Book a meeting because we guaranteed 40% faster shipping"
      })
    );
    const result = validateLiveCoachOutput(parsed, {
      campaign,
      playbook,
      utterances: [utterance],
      snapshot,
      firstObjection: true
    });
    expect(result.ok).toBe(false);
  });
});
