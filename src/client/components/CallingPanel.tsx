import { useEffect, useState } from "react";
import type { CallSessionView } from "../state/calls";
import { fetchCallSession, cancelCallSession } from "../state/calls";
import { hangUpTwilioCall, setTwilioMuted } from "../twilio/device";

type CallingPanelProps = {
  session: CallSessionView;
  recordingNotice: string;
  onEnded: () => void;
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

export function CallingPanel({ session, recordingNotice, onEnded, onSession }: CallingPanelProps) {
  const [muted, setMuted] = useState(false);
  const [, setTick] = useState(0);
  const terminal = TERMINAL.has(session.status);

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
    if (terminal) {
      onEnded();
    }
  }, [terminal, onEnded]);

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

  return (
    <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-50" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Live call</p>
      <h2 className="mt-2 text-2xl font-semibold">{session.contactName || "Contact"}</h2>
      <p className="font-mono text-sm text-slate-300">{session.phoneE164}</p>
      <p className="mt-3 text-lg" aria-label={`Call state ${transportLabel(session.status)}`}>
        {transportLabel(session.status)} · {formatDuration(session.connectedAt ?? session.startedAt)}
      </p>
      <p className="mt-4 rounded-md border border-amber-400/60 bg-amber-950/40 p-3 text-sm text-amber-100" role="note">
        {recordingNotice}
      </p>
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
            void cancelCallSession(session.id).finally(onEnded);
          }}
        >
          Hang Up
        </button>
      </div>
    </section>
  );
}
