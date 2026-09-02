import type Database from "better-sqlite3";
import type { Env } from "../env.js";
import { getSession } from "../calls/ledger.js";
import { isTerminalStatus } from "../calls/state.js";
import type { DeepgramLiveConnection, DeepgramLiveFactory } from "../deepgram/types.js";
import { speakerForTrack } from "../deepgram/mapping.js";
import type { LiveEventBus, Speaker } from "../transcript/events.js";
import {
  insertGap,
  insertUtterance,
  sessionHasGaps,
  setTranscriptComplete,
  type TranscriptionHealth
} from "../transcript/utterances.js";
import type { StreamTokenStore } from "./streamTokens.js";

export type SocketDecision = { action: "ok" } | { action: "close"; code: number; reason: string };

type TwilioMediaMessage = {
  event?: string;
  sequenceNumber?: string;
  start?: {
    callSid?: string;
    tracks?: string[];
    customParameters?: Record<string, string>;
    mediaFormat?: { encoding?: string; sampleRate?: number };
  };
  media?: {
    track?: string;
    chunk?: string;
    timestamp?: string;
    payload?: string;
  };
  stop?: { callSid?: string };
};

type MediaHubDeps = {
  env: Env;
  db: Database.Database;
  streamTokens: StreamTokenStore;
  liveEvents: LiveEventBus;
  deepgramFactory: DeepgramLiveFactory;
};

class SpeakerTrack {
  private connection: DeepgramLiveConnection | null = null;
  private reconnectsUsed = 0;
  private lastSeq = -1;
  private lastTimestampMs = 0;
  private closed = false;
  private delayedTimer: ReturnType<typeof setTimeout> | null = null;
  hadGap = false;

  constructor(
    private readonly deps: MediaHubDeps,
    private readonly sessionId: string,
    private readonly speaker: Speaker,
    private readonly hub: MediaHub
  ) {}

  start(): void {
    this.openConnection();
  }

  sendAudio(sequence: number | null, timestampMs: number, payload: Buffer): void {
    if (this.closed) {
      return;
    }
    if (sequence !== null) {
      if (sequence <= this.lastSeq) {
        return;
      }
      this.lastSeq = sequence;
    }
    this.lastTimestampMs = timestampMs;
    this.connection?.sendAudio(payload);
  }

  async stop(): Promise<void> {
    this.closed = true;
    if (this.delayedTimer) {
      clearTimeout(this.delayedTimer);
      this.delayedTimer = null;
    }
    const connection = this.connection;
    this.connection = null;
    if (!connection) {
      return;
    }
    const flushMs = this.deps.env.DEEPGRAM_FLUSH_MS;
    await Promise.race([connection.flush(), sleep(flushMs)]);
    await connection.close();
  }

  private openConnection(): void {
    if (this.closed) {
      return;
    }
    const connection = this.deps.deepgramFactory({
      speaker: this.speaker,
      sessionId: this.sessionId,
      handlers: {
        onOpen: () => {
          if (this.connection === connection && !this.closed) {
            this.reconnectsUsed = 0;
            this.hub.setHealth(this.sessionId, "ok");
          }
        },
        onInterim: (text) => {
          if (this.connection === connection && !this.closed && text.trim()) {
            this.deps.liveEvents.publish(this.sessionId, {
              type: "interim",
              speaker: this.speaker,
              text
            });
          }
        },
        onFinal: (input) => {
          if (this.connection !== connection || this.closed || !input.text.trim()) {
            return;
          }
          const utterance = insertUtterance(this.deps.db, {
            sessionId: this.sessionId,
            speaker: this.speaker,
            text: input.text.trim(),
            startMs: input.startMs,
            endMs: input.endMs,
            confidence: input.confidence
          });
          this.deps.liveEvents.publish(this.sessionId, { type: "final", utterance });
        },
        onError: () => {
          void this.handleDrop(connection);
        },
        onClose: () => {
          void this.handleDrop(connection);
        }
      }
    });
    this.connection = connection;
    if (connection.unavailable) {
      this.markGap();
      this.hub.setHealth(this.sessionId, "interrupted");
    }
  }

  private async handleDrop(connection: DeepgramLiveConnection): Promise<void> {
    if (this.closed || this.connection !== connection) {
      return;
    }
    this.connection = null;
    this.markGap();
    this.hub.setHealth(this.sessionId, "interrupted");
    const session = getSession(this.deps.db, this.sessionId);
    if (!session || isTerminalStatus(session.status)) {
      return;
    }
    if (this.reconnectsUsed === 0) {
      this.reconnectsUsed = 1;
      this.openConnection();
      return;
    }
    if (this.reconnectsUsed === 1) {
      this.reconnectsUsed = 2;
      this.delayedTimer = setTimeout(() => {
        this.delayedTimer = null;
        this.openConnection();
      }, this.deps.env.DEEPGRAM_RECONNECT_DELAY_MS);
      return;
    }
    this.hub.setHealth(this.sessionId, "interrupted");
  }

  private markGap(): void {
    if (this.hadGap) {
      return;
    }
    this.hadGap = true;
    const at = this.lastTimestampMs;
    const utterance = insertGap(this.deps.db, {
      sessionId: this.sessionId,
      speaker: this.speaker,
      startMs: at,
      endMs: at
    });
    this.deps.liveEvents.publish(this.sessionId, { type: "final", utterance });
  }
}

export class MediaSocket {
  private tracks = new Map<string, SpeakerTrack>();
  private sessionId: string | null = null;
  private started = false;
  private stopped = false;

  constructor(private readonly deps: MediaHubDeps, private readonly hub: MediaHub) {}

  handle(message: unknown): SocketDecision {
    if (this.stopped) {
      return { action: "ok" };
    }
    const event = (message as TwilioMediaMessage).event;
    if (event === "connected" || event === "mark") {
      return { action: "ok" };
    }
    if (event === "start") {
      return this.onStart(message as TwilioMediaMessage);
    }
    if (event === "media") {
      this.onMedia(message as TwilioMediaMessage);
      return { action: "ok" };
    }
    if (event === "stop") {
      void this.stop();
      return { action: "ok" };
    }
    return { action: "ok" };
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    const tracks = [...this.tracks.values()];
    this.tracks.clear();
    await Promise.all(tracks.map((track) => track.stop()));
    if (this.sessionId) {
      const complete = !tracks.some((track) => track.hadGap) && !sessionHasGaps(this.deps.db, this.sessionId);
      setTranscriptComplete(this.deps.db, this.sessionId, complete);
    }
  }

  private onStart(message: TwilioMediaMessage): SocketDecision {
    if (this.started) {
      return { action: "ok" };
    }
    const params = message.start?.customParameters ?? {};
    const token = params.streamToken ?? "";
    const sessionId = this.deps.streamTokens.verify(token);
    if (!sessionId) {
      return { action: "close", code: 4403, reason: "Invalid stream token" };
    }
    const session = getSession(this.deps.db, sessionId);
    if (!session || isTerminalStatus(session.status)) {
      return { action: "close", code: 4403, reason: "Session is not active" };
    }
    if (params.sessionId && params.sessionId !== sessionId) {
      return { action: "close", code: 4403, reason: "Session mismatch" };
    }
    this.started = true;
    this.sessionId = sessionId;
    const labels = message.start?.tracks?.length ? message.start.tracks : ["inbound", "outbound"];
    for (const label of labels) {
      const speaker = speakerForTrack(label, this.deps.env);
      const track = new SpeakerTrack(this.deps, sessionId, speaker, this.hub);
      this.tracks.set(label, track);
      this.hub.bindTrack(sessionId, label, track);
      track.start();
    }
    if ([...this.tracks.values()].some((track) => track.hadGap)) {
      this.hub.setHealth(sessionId, "interrupted");
    }
    return { action: "ok" };
  }

  private onMedia(message: TwilioMediaMessage): void {
    if (!this.started || !this.sessionId) {
      return;
    }
    const label = message.media?.track ?? "inbound";
    const track = this.tracks.get(label) ?? this.tracks.get(`${label}_track`);
    if (!track || !message.media?.payload) {
      return;
    }
    const sequenceRaw = message.sequenceNumber ?? message.media.chunk;
    const sequence = sequenceRaw !== undefined ? Number(sequenceRaw) : null;
    const timestampMs = Number(message.media.timestamp ?? 0);
    const payload = Buffer.from(message.media.payload, "base64");
    track.sendAudio(Number.isFinite(sequence) ? sequence : null, Number.isFinite(timestampMs) ? timestampMs : 0, payload);
  }
}

export class MediaHub {
  private readonly health = new Map<string, TranscriptionHealth>();
  private readonly tracksBySession = new Map<string, Map<string, SpeakerTrack>>();

  constructor(private readonly deps: MediaHubDeps) {}

  createSocket(): MediaSocket {
    return new MediaSocket(this.deps, this);
  }

  getHealth(sessionId: string): TranscriptionHealth {
    return this.health.get(sessionId) ?? "unavailable";
  }

  setHealth(sessionId: string, status: TranscriptionHealth): void {
    this.health.set(sessionId, status);
    this.deps.liveEvents.publish(sessionId, { type: "health", status });
  }

  bindTrack(sessionId: string, label: string, track: SpeakerTrack): void {
    let tracks = this.tracksBySession.get(sessionId);
    if (!tracks) {
      tracks = new Map();
      this.tracksBySession.set(sessionId, tracks);
    }
    tracks.set(label, track);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
