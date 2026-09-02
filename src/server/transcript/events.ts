import type { CoachSnapshot } from "../coach/engine.js";
import type { PublicUtterance, TranscriptionHealth } from "./utterances.js";

export type Speaker = "caller" | "contact";

export type CallLiveEvent =
  | { type: "interim"; speaker: Speaker; text: string }
  | { type: "final"; utterance: PublicUtterance }
  | { type: "health"; status: TranscriptionHealth }
  | { type: "coach"; snapshot: CoachSnapshot };

export class LiveEventBus {
  private readonly listeners = new Map<string, Set<(event: CallLiveEvent) => void>>();

  subscribe(sessionId: string, listener: (event: CallLiveEvent) => void): () => void {
    let set = this.listeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.listeners.set(sessionId, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  publish(sessionId: string, event: CallLiveEvent): void {
    const set = this.listeners.get(sessionId);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(event);
    }
  }
}
