import { describe, expect, it } from "vitest";
import { evidenceInContext } from "../../src/server/coach/evidence.js";
import { sanitizePostCallOutcome, validatePostCallOutcome } from "../../src/server/review/validate.js";
import { loadCampaigns } from "../../src/server/config/campaigns.js";
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

function utterances(texts: string[]): PublicUtterance[] {
  return texts.map((text, i) => ({
    id: `u${i + 1}`,
    sessionId: "s1",
    speaker: "contact",
    text,
    startedAtMs: i * 100,
    endedAtMs: i * 100 + 50,
    confidence: 1,
    isFinal: true,
    sequence: i + 1
  }));
}

describe("evidenceInContext grounding", () => {
  it("accepts an exact verbatim quote", () => {
    const rows = utterances(["we currently verify user-facing behavior by hand every week"]);
    expect(evidenceInContext("we currently verify user-facing behavior by hand", rows, snapshot)).toBe(true);
  });

  it("accepts paraphrased evidence that embeds a verbatim quote (live-call regression)", () => {
    const rows = utterances(["I think we're okay. Thank you."]);
    const evidence =
      'The contact declined after the caller asked about management-related issues, saying, "I think we\'re okay. Thank you."';
    expect(evidenceInContext(evidence, rows, snapshot)).toBe(true);
  });

  it("accepts punctuation-insensitive matches", () => {
    const rows = utterances(["I think we're okay. Thank you."]);
    expect(evidenceInContext("i think were okay thank you", rows, snapshot)).toBe(true);
  });

  it("still rejects hallucinated evidence with no transcript overlap", () => {
    const rows = utterances(["I think we're okay. Thank you."]);
    expect(evidenceInContext("the contact runs three hundred doors on AppFolio and pays ten thousand a month", rows, snapshot)).toBe(false);
  });

  it("rejects empty evidence for yes/no states", () => {
    const rows = utterances(["hello"]);
    expect(evidenceInContext(null, rows, snapshot)).toBe(false);
    expect(evidenceInContext("   ", rows, snapshot)).toBe(false);
  });
});

describe("sanitizePostCallOutcome", () => {
  const campaign = loadCampaigns("./config/campaigns").find((item) => item.id === "lamina-sales")!;

  function baseOutput() {
    return {
      semanticOutcome: "not_interested",
      qualification: "unknown",
      qualificationReason: "Contact said they were okay.",
      criteria: {
        relevant_problem: { state: "unknown", evidence: null, confidence: 0 },
        meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
        influence: { state: "unknown", evidence: null, confidence: 0 },
        timing: { state: "unknown", evidence: null, confidence: 0 }
      },
      painOrResearchFindings: [],
      objections: [],
      nextStep: "No follow-up.",
      followUpAt: null,
      summary: "Contact said they were okay.",
      callerCommitments: [],
      contactCommitments: [],
      transcriptComplete: true,
      confidence: 0.9
    };
  }

  it("downgrades only the ungrounded criteria and keeps the extraction", () => {
    const rows = utterances(["I think we're okay. Thank you."]);
    const raw = {
      ...baseOutput(),
      criteria: {
        relevant_problem: { state: "no", evidence: "completely invented datacenter claim", confidence: 0.9 },
        meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
        influence: { state: "unknown", evidence: null, confidence: 0 },
        timing: { state: "unknown", evidence: null, confidence: 0 }
      }
    };
    expect(validatePostCallOutcome(raw, { campaign, utterances: rows, snapshot }).ok).toBe(false);
    const salvaged = sanitizePostCallOutcome(raw, { campaign, utterances: rows, snapshot });
    expect(salvaged).not.toBeNull();
    expect(salvaged!.output.semanticOutcome).toBe("not_interested");
    expect(salvaged!.output.summary).toBe("Contact said they were okay.");
    expect(salvaged!.output.criteria.relevant_problem?.state).toBe("unknown");
    expect(salvaged!.downgraded).toContain("relevant_problem");
  });

  it("clears an invalid followUpAt instead of failing", () => {
    const rows = utterances(["hello"]);
    const salvaged = sanitizePostCallOutcome({ ...baseOutput(), followUpAt: "not-a-date" }, { campaign, utterances: rows, snapshot });
    expect(salvaged).not.toBeNull();
    expect(salvaged!.output.followUpAt).toBeNull();
  });

  it("returns null for unsalvageable outcomes", () => {
    const rows = utterances(["hello"]);
    expect(sanitizePostCallOutcome({ ...baseOutput(), semanticOutcome: "made_up_outcome" }, { campaign, utterances: rows, snapshot })).toBeNull();
  });
});
