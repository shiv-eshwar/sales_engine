import type { CallLiveEvent } from "../../shared/contracts.js";

export type Speaker = "caller" | "contact";

export type { CallLiveEvent };

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
