import { useEffect, useRef, useState } from "react";
import { Alert, Button, Chip } from "@heroui/react";
import { ProspectBrief } from "./ProspectBrief";
import type { CallLiveEvent, PublicUtterance, TranscriptionHealth } from "../../shared/contracts";
import type { CallSessionView, CoachSnapshot } from "../state/calls";
import { callEventsUrl, cancelCallSession, fetchCallSession, sendCallDigits } from "../state/calls";
import { hangUpTwilioCall, sendTwilioDigits, setTwilioMuted } from "../twilio/device";
import { formatUtteranceText, humanizeId, isWarningCue } from "../copy";

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
      return "Connecting…";
    case "ringing":
      return "Ringing…";
    case "in_progress":
      return "Connected";
    case "canceled":
      return "Canceled";
    default:
      return humanizeId(status);
  }
}

function transportAria(status: string): string {
  switch (status) {
    case "created":
    case "queued":
      return "connecting";
    case "ringing":
      return "ringing";
    case "in_progress":
      return "connected";
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
  const [sentDigits, setSentDigits] = useState("");
  const [dtmfError, setDtmfError] = useState<string | null>(null);
  const [dtmfPending, setDtmfPending] = useState<string | null>(null);
  const terminal = TERMINAL.has(session.status);
  const notifiedTerminal = useRef(false);
  const canSendDigits = !terminal && session.status === "in_progress";

  async function sendDigit(digit: string) {
    if (terminal || dtmfPending) {
      return;
    }
    setDtmfPending(digit);
    setDtmfError(null);
    try {
      const viaSdk = sendTwilioDigits(digit);
      if (!viaSdk) {
        await sendCallDigits(session.id, digit);
      }
      setSentDigits((current) => (current + digit).slice(-32));
    } catch (error) {
      setDtmfError(error instanceof Error ? error.message : "Could not send digit");
    } finally {
      setDtmfPending(null);
    }
  }

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

  const connected = session.status === "in_progress";
  const ringing = session.status === "ringing";
  const warningCue = Boolean(
    coach?.cue?.shouldShow && isWarningCue(coach.cue.cueType, coach.cue.text, coach.cue.reason)
  );
  const duration = formatDuration(session.connectedAt ?? session.startedAt);

  return (
    <section
      className={`fixed inset-0 z-50 flex flex-col text-[hsl(214_40%_96%)] ${muted ? "bg-[hsl(28_42%_12%)]" : "bg-[hsl(222_36%_8%)]"}`}
      aria-live="polite"
      aria-label="Live call"
    >
      <header className="sticky top-0 z-10 shrink-0 bg-inherit px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{session.contactName || "Contact"}</h2>
            <p className="truncate font-mono text-xs text-[hsl(214_24%_68%)]">{session.phoneE164}</p>
            <p
              className={`text-sm font-medium ${ringing ? "text-[hsl(38_90%_72%)]" : "text-[hsl(214_24%_68%)]"}`}
              aria-label={`Call state ${transportAria(session.status)}`}
            >
              {transportLabel(session.status)} · {duration}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={muted ? "primary" : "outline"}
              className={muted ? "rounded-lg! bg-[hsl(38_90%_62%)] text-[hsl(28_50%_12%)]" : "rounded-lg! border-[hsl(214_20%_36%)] bg-transparent text-[hsl(214_40%_96%)]"}
              onPress={() => {
                const next = !muted;
                setTwilioMuted(next);
                setMuted(next);
              }}
              isDisabled={terminal}
            >
              {muted ? "Unmute" : "Mute"}
            </Button>
            <Button
              variant="danger"
              className={warningCue ? "rounded-lg! ring-2 ring-white ring-offset-2 ring-offset-[hsl(4_72%_42%)]" : "rounded-lg!"}
              onPress={() => {
                hangUpTwilioCall();
                if (session.status !== "in_progress") {
                  void cancelCallSession(session.id);
                }
              }}
            >
              Hang Up
            </Button>
          </div>
        </div>
        {muted ? (
          <p className="mx-auto mt-2 max-w-3xl text-sm font-semibold text-[hsl(38_90%_78%)]" role="status">
            They cannot hear you
          </p>
        ) : null}
        <p className="mx-auto mt-2 max-w-3xl text-xs text-[hsl(214_16%_52%)]" role="note">
          {recordingNotice}
        </p>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-5">
        {health === "interrupted" ? (
          <Alert status="warning" className="mb-4" role="status">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Transcription interrupted</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        {ringing && !connected ? (
          <article className="flex min-h-[40vh] items-center justify-center rounded-lg bg-[hsl(222_32%_14%)] p-5" aria-label="Live coaching cue">
            <p className="animate-pulse text-center text-4xl font-semibold tracking-tight text-[hsl(38_90%_82%)]">
              Ringing…
            </p>
          </article>
        ) : warningCue && coach?.cue ? (
          <article className="rounded-lg bg-[hsl(4_50%_16%)] p-5" aria-label="Live coaching cue" role="alert">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(4_80%_78%)]">End the call — do not contact</p>
            <p className="mt-3 text-2xl font-semibold leading-snug">{coach.cue.text}</p>
          </article>
        ) : health !== "interrupted" && coach?.cue?.shouldShow ? (
          <article className="rounded-lg bg-[hsl(222_32%_14%)] p-5" aria-label="Live coaching cue">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(214_24%_68%)]">
              {humanizeId(coach.cue.cueType)}
              <span className="ml-2 font-normal text-[hsl(214_24%_68%)]">
                Stage: {humanizeId(coach.stage ?? "opener")}
              </span>
            </p>
            <p className="mt-3 text-3xl font-semibold leading-snug tracking-tight">{coach.cue.text}</p>
          </article>
        ) : (
          <article className="rounded-lg bg-[hsl(222_32%_14%)] p-5" aria-label="Live coaching cue">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(214_24%_68%)]">Stage: {humanizeId(coach?.stage ?? "opener")}</p>
            <p className="mt-3 text-xl text-[hsl(214_24%_68%)]">
              {health === "interrupted" ? "Cue hidden while transcription is interrupted." : "No cue right now."}
            </p>
          </article>
        )}

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3 text-sm">
          <div aria-label="Talk ratio">
            Talk ratio: {Math.round((coach?.talkRatio.callerShare ?? 0) * 100)}% caller /{" "}
            {Math.round((coach?.talkRatio.contactShare ?? 0) * 100)}% contact
            {coach?.talkRatio.warn ? (
              <p className="mt-1 font-medium text-[hsl(38_90%_72%)]" role="status">
                You are talking more than 40% after a minute. Let the contact speak.
              </p>
            ) : null}
          </div>
          {health !== "interrupted" ? (
            <p className="text-xs text-[hsl(214_16%_52%)]" aria-label={`Transcription health ${healthLabel(health)}`}>
              Transcribing: {healthLabel(health)}
            </p>
          ) : null}
        </div>

        {coach && coach.qualification.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Qualification criteria">
            {coach.qualification.map((item) => (
              <li key={item.id} aria-label={`${item.id} ${item.state}`} title={item.prompt}>
                <Chip size="sm" variant="soft" color={item.state === "yes" ? "success" : item.state === "no" ? "danger" : "default"}>
                  <Chip.Label>{humanizeId(item.id)}: {item.state}</Chip.Label>
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}

        <details className="mt-5 rounded-lg bg-[hsl(222_32%_14%)] p-4" open>
          <summary className="cursor-pointer text-sm font-semibold">Live transcript</summary>
          <ol className="mt-3 space-y-2 text-sm">
            {utterances.map((utterance) => (
              <li key={utterance.id}>
                <span className="font-semibold">{speakerLabel(utterance.speaker)}: </span>
                {formatUtteranceText(utterance.text, utterance.startedAtMs, utterance.endedAtMs)}
              </li>
            ))}
            {interims.caller ? (
              <li className="text-[hsl(214_24%_68%)]">
                <span className="font-semibold">Caller (interim): </span>
                {interims.caller}
              </li>
            ) : null}
            {interims.contact ? (
              <li className="text-[hsl(214_24%_68%)]">
                <span className="font-semibold">Contact (interim): </span>
                {interims.contact}
              </li>
            ) : null}
            {utterances.length === 0 && !interims.caller && !interims.contact ? (
              <li className="text-[hsl(214_16%_52%)]">Waiting for speech…</li>
            ) : null}
          </ol>
        </details>

        {warningCue ? null : (
          <details className="mt-4 rounded-lg bg-[hsl(222_32%_14%)] p-4">
            <summary className="cursor-pointer text-sm font-semibold">Need to press a key?</summary>
            <p className="mt-2 text-xs text-[hsl(214_16%_52%)]">
              {canSendDigits
                ? "Use when an IVR asks you to press a key."
                : "Keypad is available once the call is connected."}
            </p>
            <div className="mt-3 grid max-w-[240px] grid-cols-3 gap-2" role="group" aria-label="Dialpad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  aria-label={`Send digit ${digit}`}
                  isDisabled={!canSendDigits || dtmfPending !== null}
                  onPress={() => {
                    void sendDigit(digit);
                  }}
                  className="rounded-lg! border-[hsl(214_20%_36%)] bg-transparent font-mono text-lg font-semibold text-[hsl(214_40%_96%)]"
                >
                  {dtmfPending === digit ? "…" : digit}
                </Button>
              ))}
            </div>
            {sentDigits ? (
              <p className="mt-2 font-mono text-xs text-[hsl(214_16%_52%)]" aria-label="Sent digits">
                Sent: {sentDigits}
              </p>
            ) : null}
            {dtmfError ? (
              <p className="mt-2 text-sm text-[hsl(4_80%_78%)]" role="alert">
                {dtmfError}
              </p>
            ) : null}
          </details>
        )}

        {session.preparation ? (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-semibold">Prep</summary>
            <div className="mt-3 rounded-lg bg-surface p-1 text-foreground">
              <ProspectBrief preparation={session.preparation} />
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
