import type { LlmClient, LlmCompleteInput } from "../../src/server/llm/types.js";

export class FakeLlmClient implements LlmClient {
  readonly calls: LlmCompleteInput[] = [];
  private readonly queue: Array<() => Promise<string>> = [];

  enqueueJson(payload: unknown, delayMs = 0): void {
    this.queue.push(async () => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return JSON.stringify(payload);
    });
  }

  enqueueRaw(raw: string, delayMs = 0): void {
    this.queue.push(async () => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return raw;
    });
  }

  async completeJson(input: LlmCompleteInput): Promise<string> {
    this.calls.push(input);
    const next = this.queue.shift();
    if (!next) {
      throw new Error("Fake LLM has no queued response");
    }
    return next();
  }
}

export function postCallOutput(overrides: Record<string, unknown> = {}) {
  return {
    semanticOutcome: "permission_to_follow_up",
    qualification: "unknown",
    qualificationReason: "Need a follow-up to confirm budget and timing.",
    criteria: {
      relevant_problem: { state: "yes", evidence: "we currently verify user-facing behavior by hand", confidence: 0.8 },
      meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
      influence: { state: "unknown", evidence: null, confidence: 0 },
      timing: { state: "unknown", evidence: null, confidence: 0 }
    },
    painOrResearchFindings: ["Manual verification before weekly ship"],
    objections: [],
    nextStep: "Send a 20-minute calendar hold.",
    followUpAt: null,
    summary: "Contact described a manual verification workflow and agreed to a short follow-up.",
    callerCommitments: ["Send a calendar hold"],
    contactCommitments: ["Review the agenda"],
    transcriptComplete: true,
    confidence: 0.82,
    ...overrides
  };
}

export function coachOutput(overrides: Record<string, unknown> = {}) {
  return {
    basedOnSequence: 1,
    stage: "discovery",
    shouldShow: true,
    cueType: "question",
    cue: "How do you currently verify user-facing behavior?",
    reason: "Need a concrete workflow.",
    detectedObjection: null,
    qualificationUpdates: [],
    recommendedOutcome: null,
    confidence: 0.8,
    ...overrides
  };
}
