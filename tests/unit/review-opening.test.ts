import { describe, expect, it } from "vitest";
import { openingReviewMessage } from "../../src/shared/reviewOpening.js";
import { intentFromUserMessage } from "../../src/server/review/interview.js";
import type { PublicProposal } from "../../src/shared/contracts.js";

function proposal(overrides: Partial<PublicProposal> = {}): PublicProposal {
  return {
    id: "p1",
    sessionId: "s1",
    status: "pending_review",
    kind: "connected",
    leadId: "L-100",
    campaignId: "lamina-sales",
    contactName: "Alex Rivera",
    transportOutcome: "completed",
    semanticOutcome: "permission_to_follow_up",
    qualification: "unknown",
    qualificationReason: "Need a follow-up",
    criteria: [
      { id: "relevant_problem", prompt: "Problem?", state: "yes", evidence: "we currently verify by hand", confidence: 0.8 }
    ],
    painOrResearchFindings: [],
    objections: [],
    nextStep: "Send a hold",
    followUpAt: null,
    summary: "Contact described a manual verification workflow.",
    callerCommitments: [],
    contactCommitments: [],
    transcriptComplete: true,
    confidence: 0.8,
    warnings: [],
    proposedFields: { call_status: "Completed", next_step: "Send a hold" },
    diff: [
      { key: "call_status", header: "Call Status", current: "Ready", proposed: "Completed", changed: true },
      { key: "twilio_call_sid", header: "Twilio Call SID", current: "", proposed: "CA123", changed: true }
    ],
    lastError: null,
    utterances: [],
    coachingReplay: [],
    ...overrides
  };
}

describe("openingReviewMessage", () => {
  it("summarizes the call, quotes evidence, and shows current vs proposed fields", () => {
    const text = openingReviewMessage(proposal());
    expect(text).toContain("Alex Rivera");
    expect(text).toContain("manual verification");
    expect(text).toContain("we currently verify by hand");
    expect(text).toContain("Call Status: Ready → Proposed Completed");
    expect(text).not.toContain("CA123");
    expect(text).toContain("Nothing is written until you confirm");
  });

  it("maps in-thread confirm phrases to approve without inventing fields", () => {
    expect(intentFromUserMessage("Write this update", proposal())?.action).toBe("approve");
    expect(intentFromUserMessage("skip this contact", proposal({ kind: "non_connect" }))?.action).toBe("skip");
    expect(intentFromUserMessage("set next step to Tuesday", proposal())).toBeNull();
  });

  it("makes do-not-contact prominent", () => {
    const text = openingReviewMessage(proposal({
      semanticOutcome: "do_not_contact",
      proposedFields: { call_status: "Do Not Contact" }
    }));
    expect(text.startsWith("Do not contact.")).toBe(true);
  });
});
