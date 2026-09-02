import WebSocket from "ws";
import type { Env } from "../env.js";
import type { DeepgramLiveConnection, DeepgramLiveFactory, DeepgramLiveHandlers } from "./types.js";

type DeepgramWord = { start?: number; end?: number };
type DeepgramResults = {
  type?: string;
  is_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
      words?: DeepgramWord[];
    }>;
  };
};

function listenUrl(env: Env): string {
  const params = new URLSearchParams({
    model: env.DEEPGRAM_MODEL,
    language: env.DEEPGRAM_LANGUAGE,
    encoding: "mulaw",
    sample_rate: "8000",
    channels: "1",
    interim_results: "true",
    punctuate: "true",
    smart_format: "true",
    endpointing: "300",
    utterance_end_ms: "1000"
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

function timings(words: DeepgramWord[] | undefined): { startMs: number; endMs: number } {
  if (!words || words.length === 0) {
    return { startMs: 0, endMs: 0 };
  }
  const start = words[0]?.start ?? 0;
  const end = words[words.length - 1]?.end ?? start;
  return { startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) };
}

class DeepgramLiveSocket implements DeepgramLiveConnection {
  private readonly socket: WebSocket;
  private readonly keepAlive: ReturnType<typeof setInterval>;
  private closed = false;

  constructor(
    env: Env,
    apiKey: string,
    private readonly handlers: DeepgramLiveHandlers
  ) {
    this.socket = new WebSocket(listenUrl(env), {
      headers: { Authorization: `Token ${apiKey}` }
    });
    this.socket.on("open", () => {
      if (!this.closed) {
        this.handlers.onOpen();
      }
    });
    this.socket.on("message", (raw) => {
      this.onMessage(raw.toString());
    });
    this.socket.on("error", (error) => {
      if (!this.closed) {
        this.handlers.onError(error instanceof Error ? error : new Error("Deepgram socket error"));
      }
    });
    this.socket.on("close", () => {
      if (!this.closed) {
        this.handlers.onClose();
      }
    });
    this.keepAlive = setInterval(() => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, 5000);
  }

  private onMessage(raw: string): void {
    let parsed: DeepgramResults;
    try {
      parsed = JSON.parse(raw) as DeepgramResults;
    } catch {
      return;
    }
    if (parsed.type === "Error") {
      this.handlers.onError(new Error("Deepgram error"));
      return;
    }
    if (parsed.type && parsed.type !== "Results") {
      return;
    }
    const alternative = parsed.channel?.alternatives?.[0];
    const text = alternative?.transcript?.trim() ?? "";
    if (!text) {
      return;
    }
    const { startMs, endMs } = timings(alternative?.words);
    const confidence = typeof alternative?.confidence === "number" ? alternative.confidence : null;
    if (parsed.is_final) {
      this.handlers.onFinal({ text, startMs, endMs, confidence });
      return;
    }
    this.handlers.onInterim(text);
  }

  sendAudio(chunk: Buffer): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(chunk);
    }
  }

  async flush(): Promise<void> {
    await this.finish("CloseStream");
  }

  async close(): Promise<void> {
    await this.finish(null);
  }

  private finish(closeMessage: "CloseStream" | null): Promise<void> {
    if (this.closed && this.socket.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }
    this.closed = true;
    clearInterval(this.keepAlive);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.socket.terminate();
        resolve();
      }, 1000);
      this.socket.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      if (this.socket.readyState === WebSocket.OPEN) {
        if (closeMessage) {
          this.socket.send(JSON.stringify({ type: closeMessage }));
        }
        this.socket.close();
      } else if (this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.terminate();
        resolve();
      } else {
        clearTimeout(timer);
        resolve();
      }
    });
  }
}

class UnavailableDeepgram implements DeepgramLiveConnection {
  readonly unavailable = true;

  sendAudio(_chunk: Buffer): void {}

  async flush(): Promise<void> {}

  async close(): Promise<void> {}
}

export function createDeepgramFactory(env: Env): DeepgramLiveFactory {
  const apiKey = env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    return () => new UnavailableDeepgram();
  }
  return ({ handlers }) => new DeepgramLiveSocket(env, apiKey, handlers);
}
