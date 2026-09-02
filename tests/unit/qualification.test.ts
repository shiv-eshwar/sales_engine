import { describe, expect, it } from "vitest";
import { loadCampaigns } from "../../src/server/config/campaigns.js";
import {
  applyQualificationUpdates,
  emptyCriteria,
  recommendOutcome
} from "../../src/server/coach/qualification.js";
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

function utterance(text: string): PublicUtterance {
  return {
    id: "u1",
    sessionId: "s1",
    speaker: "contact",
    text,
    startedAtMs: 0,
    endedAtMs: 100,
    confidence: 1,
    isFinal: true,
    sequence: 1
  };
}

describe("Qualification reducer", () => {
  const campaign = loadCampaigns("./config/campaigns").find((item) => item.id === "lamina-sales")!;

  it("keeps unknown without evidence and ignores yes without transcript evidence", () => {
    const current = emptyCriteria(campaign);
    const next = applyQualificationUpdates(
      campaign,
      current,
      [
        { criterion: "relevant_problem", state: "yes", evidence: "not in the call", confidence: 0.9 },
        { criterion: "unknown_criterion", state: "yes", evidence: "we have the problem", confidence: 0.9 }
      ],
      [utterance("we have the problem every week")],
      snapshot
    );
    expect(next.relevant_problem?.state).toBe("unknown");
    expect(next.unknown_criterion).toBeUndefined();
    expect(recommendOutcome(campaign, next, { doNotContact: false, detectedObjection: null })).toBe("unknown");
  });

  it("maps a configured disqualifier with evidence to a deterministic recommendation", () => {
    const current = emptyCriteria(campaign);
    const next = applyQualificationUpdates(
      campaign,
      current,
      [{ criterion: "relevant_problem", state: "no", evidence: "we do not ship software", confidence: 0.95 }],
      [utterance("we do not ship software")],
      snapshot
    );
    expect(next.relevant_problem?.state).toBe("no");
    expect(recommendOutcome(campaign, next, { doNotContact: false, detectedObjection: null })).toBe("disqualified");
  });

  it("maps explicit do-not-contact to do_not_contact", () => {
    const current = emptyCriteria(campaign);
    expect(recommendOutcome(campaign, current, { doNotContact: true, detectedObjection: "do_not_contact" })).toBe(
      "do_not_contact"
    );
  });
});
