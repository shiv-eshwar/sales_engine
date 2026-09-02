import { useEffect, useRef, useState } from "react";
import type { CallLiveEvent, PublicUtterance, TranscriptionHealth } from "../../shared/contracts";
import type { CallSessionView, CoachSnapshot } from "../state/calls";
import { callEventsUrl, cancelCallSession, fetchCallSession } from "../state/calls";
import { hangUpTwilioCall, setTwilioMuted } from "../twilio/device";

type CallingPanelProps = {
  session: CallSessionView;
  recordingNotice: string;
  onTerminal: () => void;
  onSession: (session: CallSessionView) => void;
};

const TERMINAL = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

function formatDuration(startedAt: string | null): string {
  if (!startedAt) {
    return "00:00";
  }
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function transportLabel(status: string): string {
  switch (status) {
    case "created":
    case "queued":
      return "connecting";
    case "ringing":
      return "ringing";
    case "in_progress":
      return "connected";
    case "canceled":
      return "canceled";
    default:
      return status.replaceAll("_", " ");
  }
}

function healthLabel(health: TranscriptionHealth): string {
  switch (health) {
    case "ok":
      return "ok";
    case "interrupted":
      return "interrupted";
    default:
      return "unavailable";
  }
}

function mergeUtterances(current: PublicUtterance[], incoming: PublicUtterance[]): PublicUtterance[] {
  const byId = new Map<string, PublicUtterance>();
  for (const utterance of current) {
    byId.set(utterance.id, utterance);
  }
  for (const utterance of incoming) {
    byId.set(utterance.id, utterance);
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

function speakerLabel(speaker: "caller" | "contact"): string {
  return speaker === "contact" ? "Contact" : "Caller";
}

export function CallingPanel({ session, recordingNotice, onTerminal, onSession }: CallingPanelProps) {
  const [muted, setMuted] = useState(false);
  const [, setTick] = useState(0);
  const [health, setHealth] = useState<TranscriptionHealth>(session.transcriptionHealth ?? "unavailable");
  const [utterances, setUtterances] = useState<PublicUtterance[]>(session.utterances ?? []);
  const [interims, setInterims] = useState<{ caller?: string; contact?: string }>({});
  const [coach, setCoach] = useState<CoachSnapshot | null>(session.coach ?? null);
  const terminal = TERMINAL.has(session.status);
  const notifiedTerminal = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (terminal) {
      return undefined;
    }
    const poll = window.setInterval(() => {
      void fetchCallSession(session.id).then(onSession);
    }, 1000);
    return () => window.clearInterval(poll);
  }, [session.id, terminal, onSession]);

  useEffect(() => {
    if (terminal && !notifiedTerminal.current) {
      notifiedTerminal.current = true;
      onTerminal();
    }
  }, [terminal, onTerminal]);

  useEffect(() => {
    if (terminal) {
      return undefined;
    }
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [terminal]);

  useEffect(() => {
    setHealth(session.transcriptionHealth ?? "unavailable");
    setUtterances((current) => mergeUtterances(current, session.utterances ?? []));
    if (session.coach) {
      setCoach(session.coach);
    }
  }, [session]);

  useEffect(() => {
    if (terminal) {
      return undefined;
    }
    const socket = new WebSocket(callEventsUrl(session.id));
    socket.onmessage = (event) => {
      let parsed: CallLiveEvent;
      try {
        parsed = JSON.parse(String(event.data)) as CallLiveEvent;
      } catch {
        return;
      }
      if (parsed.type === "health") {
        setHealth(parsed.status);
        return;
      }
      if (parsed.type === "final") {
        setUtterances((current) => mergeUtterances(current, [parsed.utterance]));
        setInterims((current) => ({ ...current, [parsed.utterance.speaker]: undefined }));
        return;
      }
      if (parsed.type === "interim") {
        setInterims((current) => ({ ...current, [parsed.speaker]: parsed.text }));
        return;
      }
      if (parsed.type === "coach") {
        setCoach(parsed.snapshot);
      }
    };
    return () => {
      socket.close();
    };
  }, [session.id, terminal]);

  return (
    <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-50" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Live call</p>
      <h2 className="mt-2 text-2xl font-semibold">{session.contactName || "Contact"}</h2>
      <p className="font-mono text-sm text-slate-300">{session.phoneE164}</p>
      <p className="mt-3 text-lg" aria-label={`Call state ${transportLabel(session.status)}`}>
        {transportLabel(session.status)} · {formatDuration(session.connectedAt ?? session.startedAt)}
      </p>
      <p className="mt-2 text-sm" aria-label={`Call stage ${coach?.stage ?? "opener"}`}>
        Stage: {(coach?.stage ?? "opener").replaceAll("_", " ")}
      </p>
      {health !== "interrupted" && coach?.cue?.shouldShow ? (
        <article className="mt-4 rounded-md border border-emerald-400/70 bg-emerald-950/40 p-4" aria-label="Live coaching cue">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-200">{coach.cue.cueType}</p>
          <p className="mt-1 text-xl font-semibold leading-snug">{coach.cue.text}</p>
        </article>
      ) : (
        <article className="mt-4 rounded-md border border-slate-700 p-4" aria-label="Live coaching cue">
          <p className="text-sm text-slate-400">
            {health === "interrupted" ? "Cue hidden while transcription is interrupted." : "No cue right now."}
          </p>
        </article>
      )}
      <div className="mt-3 text-sm" aria-label="Talk ratio">
        Talk ratio: {Math.round((coach?.talkRatio.callerShare ?? 0) * 100)}% caller /{" "}
        {Math.round((coach?.talkRatio.contactShare ?? 0) * 100)}% contact
        {coach?.talkRatio.warn ? (
          <p className="mt-1 text-amber-200" role="status">
            You are talking more than 40% after a minute. Let the contact speak.
          </p>
        ) : null}
      </div>
      {coach && coach.qualification.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Qualification criteria">
          {coach.qualification.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs"
              aria-label={`${item.id} ${item.state}`}
            >
              {item.id.replaceAll("_", " ")}: {item.state}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-sm" aria-label={`Transcription health ${healthLabel(health)}`}>
        Transcription health: {healthLabel(health)}
      </p>
      {health === "interrupted" ? (
        <p className="mt-2 text-sm text-amber-200" role="status">
          Transcription interrupted
        </p>
      ) : null}
      <p className="mt-4 rounded-md border border-amber-400/60 bg-amber-950/40 p-3 text-sm text-amber-100" role="note">
        {recordingNotice}
      </p>
      <details className="mt-4 rounded-md border border-slate-700 p-3" open>
        <summary className="cursor-pointer text-sm font-medium">Live transcript</summary>
        <ol className="mt-3 space-y-2 text-sm">
          {utterances.map((utterance) => (
            <li key={utterance.id}>
              <span className="font-semibold">{speakerLabel(utterance.speaker)}: </span>
              {utterance.text}
            </li>
          ))}
          {interims.caller ? (
            <li className="text-slate-400">
              <span className="font-semibold">Caller (interim): </span>
              {interims.caller}
            </li>
          ) : null}
          {interims.contact ? (
            <li className="text-slate-400">
              <span className="font-semibold">Contact (interim): </span>
              {interims.contact}
            </li>
          ) : null}
          {utterances.length === 0 && !interims.caller && !interims.contact ? (
            <li className="text-slate-500">Waiting for speech…</li>
          ) : null}
        </ol>
      </details>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100"
          onClick={() => {
            const next = !muted;
            setTwilioMuted(next);
            setMuted(next);
          }}
          disabled={terminal}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className="rounded-md bg-red-700 px-4 py-2 font-medium text-white"
          onClick={() => {
            hangUpTwilioCall();
            if (session.status !== "in_progress") {
              void cancelCallSession(session.id);
            }
          }}
        >
          Hang Up
        </button>
      </div>
    </section>
  );
}
