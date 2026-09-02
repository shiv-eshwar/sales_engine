import type {
  DeepgramLiveConnection,
  DeepgramLiveFactory,
  DeepgramLiveHandlers
} from "../../src/server/deepgram/types.js";
import type { Speaker } from "../../src/server/transcript/events.js";

export class FakeDeepgramConnection implements DeepgramLiveConnection {
  audio: Buffer[] = [];
  closed = false;
  failed = false;

  constructor(
    readonly speaker: Speaker,
    private readonly handlers: DeepgramLiveHandlers
  ) {}

  sendAudio(chunk: Buffer): void {
    this.audio.push(chunk);
  }

  async flush(): Promise<void> {}

  async close(): Promise<void> {
    this.closed = true;
  }

  open(): void {
    if (!this.failed && !this.closed) {
      this.handlers.onOpen();
    }
  }

  emitInterim(text: string): void {
    this.handlers.onInterim(text);
  }

  emitFinal(text: string, startMs = 0, endMs = 100, confidence: number | null = 0.9): void {
    this.handlers.onFinal({ text, startMs, endMs, confidence });
  }

  fail(error = new Error("deepgram drop")): void {
    this.failed = true;
    this.handlers.onError(error);
  }
}

export function createFakeDeepgramFactory(bucket: FakeDeepgramConnection[]): DeepgramLiveFactory {
  return ({ speaker, handlers }) => {
    const connection = new FakeDeepgramConnection(speaker, handlers);
    bucket.push(connection);
    return connection;
  };
}
