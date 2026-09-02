import type Database from "better-sqlite3";
import type { CampaignConfig, PlaybookConfig } from "../../shared/schemas.js";
import type { Env } from "../env.js";
import { getSession, type LeadSnapshot } from "../calls/ledger.js";
import type { LlmClient } from "../llm/types.js";
import type { LiveEventBus } from "../transcript/events.js";
import { listUtterances, type PublicUtterance } from "../transcript/utterances.js";
import { detectsDoNotContact, isMeaningfulContactText } from "./dnc.js";
import { buildCoachPrompt } from "./prompt.js";
import {
  applyQualificationUpdates,
  emptyCriteria,
  qualificationView,
  recommendOutcome,
  type CriterionState,
  type QualificationView
} from "./qualification.js";
import { liveCoachOutputSchema, type LiveCoachOutput } from "./schema.js";
import { insertCoachingEvent } from "./store.js";
import { computeTalkRatio, type TalkRatio } from "./talkRatio.js";
import { validateLiveCoachOutput } from "./validate.js";

export type CoachCue = {
  text: string;
  cueType: string;
  reason: string;
  shouldShow: boolean;
  basedOnSequence: number;
};

export type CoachSnapshot = {
  stage: string;
  cue: CoachCue | null;
  qualification: QualificationView[];
  recommendedOutcome: string | null;
  talkRatio: TalkRatio;
  priorObjections: string[];
};

type SessionCoach = {
  criteria: Record<string, CriterionState>;
  stage: string;
  cue: CoachCue | null;
  recommendedOutcome: string | null;
  priorObjections: string[];
  lastRequestAt: number;
  inFlightSequence: number | null;
  latestContactSequence: number;
  sawObjection: boolean;
};

const DNC_CUE = "Acknowledge and end respectfully. They asked not to be contacted.";

export class CoachEngine {
  private readonly sessions = new Map<string, SessionCoach>();
  private readonly stopped = new Set<string>();

  constructor(
    private readonly deps: {
      env: Env;
      db: Database.Database;
      campaigns: CampaignConfig[];
      playbook: PlaybookConfig | null;
      llm: LlmClient | null;
      liveEvents: LiveEventBus;
    }
  ) {}

  stop(sessionId: string): void {
    this.stopped.add(sessionId);
  }

  getSnapshot(sessionId: string): CoachSnapshot | null {
    const session = getSession(this.deps.db, sessionId);
    if (!session) {
      return null;
    }
    const campaign = this.deps.campaigns.find((item) => item.id === session.campaign_id);
    const utterances = listUtterances(this.deps.db, sessionId);
    const talk = computeTalkRatio(utterances, session.connected_at, this.deps.playbook);
    const state = this.sessions.get(sessionId);
    const criteria = state?.criteria ?? (campaign ? emptyCriteria(campaign) : {});
    return {
      stage: state?.stage ?? "opener",
      cue: state?.cue ?? null,
      qualification: campaign ? qualificationView(campaign, criteria) : [],
      recommendedOutcome: state?.recommendedOutcome ?? "unknown",
      talkRatio: talk,
      priorObjections: state?.priorObjections ?? []
    };
  }

  consider(utterance: PublicUtterance): void {
    if (this.stopped.has(utterance.sessionId)) {
      return;
    }
    const talkPublished = this.publishTalk(utterance.sessionId);
    if (!talkPublished) {
      return;
    }
    if (utterance.speaker !== "contact" || !isMeaningfulContactText(utterance.text)) {
      return;
    }
    void this.run(utterance);
  }

  private publishTalk(sessionId: string): CoachSnapshot | null {
    const snapshot = this.getSnapshot(sessionId);
    if (!snapshot) {
      return null;
    }
    this.deps.liveEvents.publish(sessionId, { type: "coach", snapshot });
    return snapshot;
  }

  private stateFor(sessionId: string, campaign: CampaignConfig): SessionCoach {
    let state = this.sessions.get(sessionId);
    if (!state) {
      state = {
        criteria: emptyCriteria(campaign),
        stage: "opener",
        cue: null,
        recommendedOutcome: "unknown",
        priorObjections: [],
        lastRequestAt: 0,
        inFlightSequence: null,
        latestContactSequence: 0,
        sawObjection: false
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  private async run(utterance: PublicUtterance): Promise<void> {
    const row = getSession(this.deps.db, utterance.sessionId);
    if (!row || row.status !== "in_progress") {
      return;
    }
    const campaign = this.deps.campaigns.find((item) => item.id === row.campaign_id);
    if (!campaign) {
      return;
    }
    const snapshot = JSON.parse(row.lead_snapshot_json) as LeadSnapshot;
    const state = this.stateFor(utterance.sessionId, campaign);
    state.latestContactSequence = Math.max(state.latestContactSequence, utterance.sequence);

    const urgent = detectsDoNotContact(utterance.text);
    if (urgent) {
      this.applyValidated(
        utterance.sessionId,
        campaign,
        snapshot,
        listUtterances(this.deps.db, utterance.sessionId),
        state,
        {
          basedOnSequence: utterance.sequence,
          stage: "closed",
          shouldShow: true,
          cueType: "warning",
          cue: DNC_CUE,
          reason: "Contact asked not to be contacted.",
          detectedObjection: "do_not_contact",
          qualificationUpdates: [],
          recommendedOutcome: "do_not_contact",
          confidence: 1
        },
        true
      );
      return;
    }

    if (state.inFlightSequence !== null && state.inFlightSequence >= utterance.sequence) {
      return;
    }
    const now = Date.now();
    if (!urgent && now - state.lastRequestAt < this.deps.env.COACH_RATE_LIMIT_MS) {
      return;
    }
    if (!this.deps.llm) {
      return;
    }

    const utterances = listUtterances(this.deps.db, utterance.sessionId);
    const talk = computeTalkRatio(utterances, row.connected_at, this.deps.playbook);
    const prompt = buildCoachPrompt({
      campaign,
      playbook: this.deps.playbook,
      snapshot,
      utterances,
      criteria: state.criteria,
      talk,
      stage: state.stage,
      priorObjections: state.priorObjections,
      sequence: utterance.sequence,
      connectedSeconds: talk.connectedSeconds
    });

    state.lastRequestAt = now;
    state.inFlightSequence = utterance.sequence;
    try {
      const raw = await this.deps.llm.completeJson(prompt);
      if (utterance.sequence < state.latestContactSequence) {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const schema = liveCoachOutputSchema.safeParse(parsed);
      if (!schema.success) {
        return;
      }
      if (schema.data.basedOnSequence < state.latestContactSequence) {
        return;
      }
      const minConfidence = this.deps.playbook?.cue_min_confidence ?? 0.5;
      const output: LiveCoachOutput = {
        ...schema.data,
        shouldShow: schema.data.shouldShow && schema.data.confidence >= minConfidence
      };
      const firstObjection = Boolean(output.detectedObjection) && !state.sawObjection;
      const validated = validateLiveCoachOutput(output, {
        campaign,
        playbook: this.deps.playbook,
        utterances,
        snapshot,
        firstObjection
      });
      if (!validated.ok) {
        return;
      }
      this.applyValidated(utterance.sessionId, campaign, snapshot, utterances, state, validated.output, false);
    } catch {
      // LLM failure: no cue, call continues
    } finally {
      if (state.inFlightSequence === utterance.sequence) {
        state.inFlightSequence = null;
      }
    }
  }

  private applyValidated(
    sessionId: string,
    campaign: CampaignConfig,
    snapshot: LeadSnapshot,
    utterances: PublicUtterance[],
    state: SessionCoach,
    output: LiveCoachOutput,
    doNotContact: boolean
  ): void {
    state.criteria = applyQualificationUpdates(
      campaign,
      state.criteria,
      output.qualificationUpdates,
      utterances,
      snapshot
    );
    state.stage = output.stage;
    state.recommendedOutcome = recommendOutcome(campaign, state.criteria, {
      doNotContact: doNotContact || output.detectedObjection === "do_not_contact",
      detectedObjection: output.detectedObjection
    });
    if (output.detectedObjection && !state.priorObjections.includes(output.detectedObjection)) {
      state.priorObjections = [...state.priorObjections, output.detectedObjection];
      state.sawObjection = true;
    }
    if (output.shouldShow) {
      state.cue = {
        text: output.cue,
        cueType: output.cueType,
        reason: output.reason,
        shouldShow: true,
        basedOnSequence: output.basedOnSequence
      };
    } else {
      state.cue = null;
    }
    insertCoachingEvent(this.deps.db, {
      sessionId,
      output: { ...output, recommendedOutcome: state.recommendedOutcome },
      shown: Boolean(output.shouldShow)
    });
    this.publishTalk(sessionId);
  }
}
