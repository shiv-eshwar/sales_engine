import type Database from "better-sqlite3";
import type { CampaignConfig, PlaybookConfig } from "../../shared/schemas.js";
import type { Env } from "../env.js";
import { getSession, sessionCampaign, type LeadSnapshot } from "../calls/ledger.js";
import type { LlmClient } from "../llm/types.js";
import type { LiveEventBus } from "../transcript/events.js";
import { listUtterances, type PublicUtterance } from "../transcript/utterances.js";
import type { CalendarClient } from "../calendar/types.js";
import { draftFromUnknown } from "../calendar/draft.js";
import { insertCalendarProposal } from "../calendar/proposals.js";
import { detectsDoNotContact, isMeaningfulContactText } from "./dnc.js";
import { insertCoachMessage, listCoachMessages } from "./messages.js";
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
import type { PublicCoachMessage } from "../../shared/contracts.js";

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
  talkWarnIssued: boolean;
};

const DNC_CUE = "Acknowledge and end respectfully. They asked not to be contacted.";
const TALK_WARN = "You are talking more than 40% after a minute. Let the contact speak.";

export class CoachEngine {
  private readonly sessions = new Map<string, SessionCoach>();
  private readonly stopped = new Set<string>();
  private paused = false;

  constructor(
    private readonly deps: {
      env: Env;
      db: Database.Database;
      campaigns: CampaignConfig[];
      playbook: PlaybookConfig | null;
      llm: LlmClient | null;
      liveEvents: LiveEventBus;
      calendar: CalendarClient;
    }
  ) {}

  pauseAll(): void {
    this.paused = true;
  }

  stop(sessionId: string): void {
    this.stopped.add(sessionId);
  }

  getSnapshot(sessionId: string): CoachSnapshot | null {
    const session = getSession(this.deps.db, sessionId);
    if (!session) {
      return null;
    }
    const campaign = sessionCampaign(session, this.deps.campaigns);
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

  listMessages(sessionId: string): PublicCoachMessage[] {
    return listCoachMessages(this.deps.db, sessionId);
  }

  consider(utterance: PublicUtterance): void {
    if (this.paused || this.stopped.has(utterance.sessionId)) {
      return;
    }
    const talkPublished = this.publishTalk(utterance.sessionId);
    if (!talkPublished) {
      return;
    }
    if (utterance.speaker !== "contact" || !isMeaningfulContactText(utterance.text)) {
      return;
    }
    void this.run(utterance, { rateLimit: true });
  }

  async chat(sessionId: string, text: string): Promise<{ messages: PublicCoachMessage[]; snapshot: CoachSnapshot | null }> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Message is empty");
    }
    const row = getSession(this.deps.db, sessionId);
    if (!row || row.status !== "in_progress") {
      throw new Error("Call is not connected");
    }
    const userMessage = insertCoachMessage(this.deps.db, {
      sessionId,
      role: "user",
      text: trimmed,
      basedOnSequence: this.sessions.get(sessionId)?.latestContactSequence ?? null
    });
    this.deps.liveEvents.publish(sessionId, { type: "coach_message", message: userMessage });

    const synthetic: PublicUtterance = {
      id: `operator-${Date.now()}`,
      sessionId,
      speaker: "caller",
      text: trimmed,
      startedAtMs: 0,
      endedAtMs: 0,
      confidence: 1,
      isFinal: true,
      sequence: this.sessions.get(sessionId)?.latestContactSequence ?? 0
    };
    await this.run(synthetic, { rateLimit: false, operatorNote: trimmed, skipContactCheck: true });
    return {
      messages: this.listMessages(sessionId),
      snapshot: this.getSnapshot(sessionId)
    };
  }

  private publishTalk(sessionId: string): CoachSnapshot | null {
    const snapshot = this.getSnapshot(sessionId);
    if (!snapshot) {
      return null;
    }
    const session = getSession(this.deps.db, sessionId);
    const campaign = session ? sessionCampaign(session, this.deps.campaigns) : undefined;
    if (campaign && snapshot.talkRatio.warn) {
      const state = this.stateFor(sessionId, campaign);
      if (!state.talkWarnIssued) {
        state.talkWarnIssued = true;
        const message = insertCoachMessage(this.deps.db, {
          sessionId,
          role: "system",
          text: TALK_WARN
        });
        this.deps.liveEvents.publish(sessionId, { type: "coach_message", message });
      }
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
        sawObjection: false,
        talkWarnIssued: false
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  private async availabilityNote(): Promise<string> {
    const status = this.deps.calendar.status();
    if (!status.connected) {
      return "Calendar is disconnected. You may still draft a calendarProposal; nothing is sent until the operator Connects and presses Approve.";
    }
    const start = new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    try {
      const busy = await this.deps.calendar.getAvailability(start.toISOString(), end.toISOString());
      return JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), busy });
    } catch (error) {
      return `Calendar availability could not be read: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  }

  private async run(
    utterance: PublicUtterance,
    options: { rateLimit: boolean; operatorNote?: string; skipContactCheck?: boolean }
  ): Promise<void> {
    const row = getSession(this.deps.db, utterance.sessionId);
    if (!row || row.status !== "in_progress") {
      return;
    }
    const campaign = sessionCampaign(row, this.deps.campaigns);
    if (!campaign) {
      return;
    }
    const snapshot = JSON.parse(row.lead_snapshot_json) as LeadSnapshot;
    const state = this.stateFor(utterance.sessionId, campaign);
    if (!options.skipContactCheck) {
      state.latestContactSequence = Math.max(state.latestContactSequence, utterance.sequence);
    }

    const urgent = !options.skipContactCheck && detectsDoNotContact(utterance.text);
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

    if (!options.skipContactCheck && state.inFlightSequence !== null && state.inFlightSequence >= utterance.sequence) {
      return;
    }
    const now = Date.now();
    if (options.rateLimit && now - state.lastRequestAt < this.deps.env.COACH_RATE_LIMIT_MS) {
      return;
    }
    if (!this.deps.llm) {
      if (options.operatorNote) {
        const message = insertCoachMessage(this.deps.db, {
          sessionId: utterance.sessionId,
          role: "assistant",
          text: "Coach is offline. The call continues."
        });
        this.deps.liveEvents.publish(utterance.sessionId, { type: "coach_message", message });
      }
      return;
    }

    const utterances = listUtterances(this.deps.db, utterance.sessionId);
    const talk = computeTalkRatio(utterances, row.connected_at, this.deps.playbook);
    const calendarAvailability = await this.availabilityNote();
    const prompt = buildCoachPrompt({
      campaign,
      playbook: this.deps.playbook,
      snapshot,
      utterances,
      criteria: state.criteria,
      talk,
      stage: state.stage,
      priorObjections: state.priorObjections,
      sequence: utterance.sequence || state.latestContactSequence,
      connectedSeconds: talk.connectedSeconds,
      calendarAvailability,
      operatorNote: options.operatorNote
    });

    if (options.rateLimit) {
      state.lastRequestAt = now;
      state.inFlightSequence = utterance.sequence;
    }
    try {
      const raw = await this.deps.llm.completeJson(prompt);
      if (!options.skipContactCheck && utterance.sequence < state.latestContactSequence) {
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
      if (!options.skipContactCheck && schema.data.basedOnSequence < state.latestContactSequence) {
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
      if (options.rateLimit && state.inFlightSequence === utterance.sequence) {
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
    const say = (output.say?.trim() || output.cue).trim();
    if (output.shouldShow) {
      state.cue = {
        text: say,
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
      output: { ...output, recommendedOutcome: state.recommendedOutcome, cue: say },
      shown: Boolean(output.shouldShow)
    });

    let calendarProposalId: string | null = null;
    if (output.calendarProposal) {
      const draft = draftFromUnknown(output.calendarProposal, `${snapshot.fullName} / ${snapshot.company}`.replace(/ \/ $/, ""));
      if (draft) {
        const proposal = insertCalendarProposal(this.deps.db, {
          sessionId,
          source: "live_coach",
          draft
        });
        calendarProposalId = proposal.id;
      }
    }

    if (output.shouldShow || calendarProposalId) {
      const message = insertCoachMessage(this.deps.db, {
        sessionId,
        role: "assistant",
        text: output.shouldShow ? say : "Draft calendar event — nothing is sent until you Approve.",
        basedOnSequence: output.basedOnSequence,
        calendarProposalId
      });
      this.deps.liveEvents.publish(sessionId, { type: "coach_message", message });
    }
    this.publishTalk(sessionId);
  }
}
