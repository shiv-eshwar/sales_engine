import type { Speaker } from "../transcript/events.js";

export type DeepgramLiveHandlers = {
  onOpen: () => void;
  onInterim: (text: string) => void;
  onFinal: (input: { text: string; startMs: number; endMs: number; confidence: number | null }) => void;
  onError: (error: Error) => void;
  onClose: () => void;
};

export type DeepgramLiveConnection = {
  sendAudio: (chunk: Buffer) => void;
  flush: () => Promise<void>;
  close: () => Promise<void>;
  readonly unavailable?: boolean;
};

export type DeepgramLiveFactory = (input: {
  speaker: Speaker;
  sessionId: string;
  handlers: DeepgramLiveHandlers;
}) => DeepgramLiveConnection;
