import { useEffect, useRef, useState } from "react";
import { Alert, Button, Chip } from "@heroui/react";
import { ProspectBrief } from "./ProspectBrief";
import { QuoteMark } from "./Icon";
import type { CallLiveEvent, PublicUtterance, TranscriptionHealth } from "../../shared/contracts";
import type { ProspectPreparation } from "../../shared/campaigns";
import type { CallSessionView, CoachSnapshot } from "../state/calls";
import { callEventsUrl, cancelCallSession, fetchCallSession, sendCallDigits } from "../state/calls";
import { hangUpTwilioCall, sendTwilioDigits, setTwilioMuted } from "../twilio/device";
import { formatUtteranceText, humanizeId, isWarningCue } from "../copy";
import { SCROLL, SCROLLBAR, SHELL } from "../layout/shell";

type CallingPanelProps = {
  session: CallSessionView;
  recordingNotice: string;
  preparation?: ProspectPreparation | null;
  opening?: string | null;
  firstQuestion?: string | null;
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

export function CallingPanel({
  session,
  recordingNotice,
  preparation,
  opening,
  firstQuestion,
  onTerminal,
  onSession
}: CallingPanelProps) {
  const [muted, setMuted] = useState(false);
  const [, setTick] = useState(0);
  const [health, setHealth] = useState<TranscriptionHealth>(session.transcriptionHealth ?? "unavailable");
  const [utterances, setUtterances] = useState<PublicUtterance[]>(session.utterances ?? []);
  const [interims, setInterims] = useState<{ caller?: string; contact?: string }>({});
  const [coach, setCoach] = useState<CoachSnapshot | null>(session.coach ?? null);
  const [sentDigits, setSentDigits] = useState("");
  const [dtmfError, setDtmfError] = useState<string | null>(null);
  const [dtmfPending, setDtmfPending] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLOListElement>(null);
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

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [utterances, interims]);

  const connected = session.status === "in_progress";
  const ringing = session.status === "ringing";
  const warningCue = Boolean(
    coach?.cue?.shouldShow && isWarningCue(coach.cue.cueType, coach.cue.text, coach.cue.reason)
  );
  const duration = formatDuration(session.connectedAt ?? session.startedAt);
  const callerShare = Math.round((coach?.talkRatio.callerShare ?? 0) * 100);
  const prep = session.preparation ?? preparation ?? null;
  const hasPrep = Boolean(prep || opening || firstQuestion);

  return (
    <section
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-background text-foreground"
      aria-live="polite"
      aria-label="Live call"
    >
      <div className="h-[3px] shrink-0 bg-accent" />
      <header className="sticky top-0 z-20 shrink-0 bg-background">
        <div className={`${SHELL} flex min-h-14 flex-wrap items-center gap-3 py-3`}>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{session.contactName || "Contact"}</h2>
            <p
              className={`text-sm ${ringing ? "font-medium text-accent" : "text-muted"}`}
              aria-label={`Call state ${transportAria(session.status)}`}
            >
              {transportLabel(session.status)}
              <span className="tabular-nums"> · {duration}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={muted ? "primary" : "outline"}
              className="min-h-11 rounded-lg!"
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
              className={warningCue ? "min-h-11 rounded-lg! ring-2 ring-danger ring-offset-2 ring-offset-background" : "min-h-11 rounded-lg!"}
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
          <p className={`${SHELL} pb-2 text-sm font-semibold text-warning`} role="status">
            They cannot hear you
          </p>
        ) : null}
        <p className={`${SHELL} pb-3 text-xs text-muted`} role="note">
          {recordingNotice}
        </p>
      </header>

      <div
        className={`${SHELL} flex min-h-0 flex-1 flex-col gap-4 ${SCROLL} py-4 lg:grid lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:pb-5 ${
          hasPrep
            ? "lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)_minmax(20rem,26rem)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]"
        }`}
      >
        {hasPrep ? (
          <aside className="order-3 flex min-h-0 flex-col max-lg:min-h-[18rem] lg:order-1 lg:h-full lg:overflow-hidden">
            <h3 className="shrink-0 text-sm font-semibold">Prep</h3>
            <div className={`mt-3 min-h-0 flex-1 ${SCROLL}`}>
              {prep ? (
                <ProspectBrief preparation={prep} compact />
              ) : (
                <div className="space-y-4 rounded-lg bg-surface p-4 shadow-sm">
                  {opening ? (
                    <div className="min-w-0 overflow-hidden rounded-lg bg-accent-soft p-4">
                      <QuoteMark />
                      <p className="mt-3 text-sm leading-relaxed break-words text-accent-soft-foreground">{opening}</p>
                    </div>
                  ) : null}
                  {firstQuestion ? <p className="text-sm leading-relaxed">{firstQuestion}</p> : null}
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <section className="order-2 flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface shadow-sm max-lg:min-h-[18rem] lg:h-full">
          <h3 className="shrink-0 px-5 pt-4 text-sm font-semibold">Live transcript</h3>
          <ol
            ref={transcriptRef}
            className={`mt-3 min-h-0 flex-1 space-y-3 ${SCROLL} px-5 pb-5 text-sm`}
          >
            {utterances.map((utterance) => (
              <li
                key={utterance.id}
                className={utterance.speaker === "caller" ? "ml-8 rounded-lg bg-accent-soft px-3 py-2" : "mr-8 rounded-lg bg-surface-secondary px-3 py-2"}
              >
                <span className="font-semibold">{speakerLabel(utterance.speaker)}: </span>
                {formatUtteranceText(utterance.text, utterance.startedAtMs, utterance.endedAtMs)}
              </li>
            ))}
            {interims.caller ? (
              <li className="ml-8 rounded-lg bg-accent-soft px-3 py-2 text-muted">
                <span className="font-semibold">Caller (interim): </span>
                {interims.caller}
              </li>
            ) : null}
            {interims.contact ? (
              <li className="mr-8 rounded-lg bg-surface-secondary px-3 py-2 text-muted">
                <span className="font-semibold">Contact (interim): </span>
                {interims.contact}
              </li>
            ) : null}
            {utterances.length === 0 && !interims.caller && !interims.contact ? (
              <li className="text-muted">Waiting for speech…</li>
            ) : null}
          </ol>
        </section>

        <div className={`order-1 flex min-h-0 flex-col gap-4 lg:order-3 lg:h-full lg:overflow-y-auto lg:overscroll-contain ${SCROLLBAR}`}>
          {health === "interrupted" ? (
            <Alert status="warning" role="status">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Transcription interrupted</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : null}

          {ringing && !connected ? (
            <article className="flex min-h-[10rem] items-center justify-center rounded-lg bg-surface p-5 shadow-sm lg:min-h-[14rem]" aria-label="Live coaching cue">
              <p className="animate-pulse text-center text-3xl font-semibold tracking-tight text-accent lg:text-4xl">
                Ringing…
              </p>
            </article>
          ) : warningCue && coach?.cue ? (
            <article className="rounded-lg bg-danger-soft p-5" aria-label="Live coaching cue" role="alert">
              <p className="text-sm font-semibold text-danger">End the call — do not contact</p>
              <p className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">{coach.cue.text}</p>
            </article>
          ) : health !== "interrupted" && coach?.cue?.shouldShow ? (
            <article className="rounded-lg border-t-[3px] border-t-accent bg-surface p-5 shadow-sm" aria-label="Live coaching cue">
              <p className="text-sm text-muted">{humanizeId(coach.cue.cueType)} · {humanizeId(coach.stage ?? "opener")}</p>
              <p className="mt-3 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{coach.cue.text}</p>
            </article>
          ) : (
            <article className="rounded-lg bg-surface p-5 shadow-sm" aria-label="Live coaching cue">
              <p className="text-sm text-muted">{humanizeId(coach?.stage ?? "opener")}</p>
              <p className="mt-3 text-xl text-muted">
                {health === "interrupted" ? "Cue hidden while transcription is interrupted." : "No cue right now."}
              </p>
            </article>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
            <div aria-label="Talk ratio">
              <p className="text-muted">
                {callerShare}% you
                {coach?.talkRatio.contactShare != null ? ` · ${Math.round(coach.talkRatio.contactShare * 100)}% them` : null}
              </p>
              {coach?.talkRatio.warn ? (
                <p className="mt-1 font-medium text-warning" role="status">
                  You are talking more than 40% after a minute. Let the contact speak.
                </p>
              ) : null}
            </div>
            {health !== "interrupted" ? (
              <p className="text-xs text-muted" aria-label={`Transcription health ${healthLabel(health)}`}>
                Transcribing: {healthLabel(health)}
              </p>
            ) : null}
          </div>

          {coach && coach.qualification.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Qualification criteria">
              {coach.qualification.map((item) => (
                <li key={item.id} aria-label={`${item.id} ${item.state}`} title={item.prompt}>
                  <Chip size="sm" variant="soft" color={item.state === "yes" ? "success" : item.state === "no" ? "danger" : "default"}>
                    <Chip.Label>{humanizeId(item.id)}: {item.state}</Chip.Label>
                  </Chip>
                </li>
              ))}
            </ul>
          ) : null}

          {warningCue ? null : (
            <details className="rounded-lg bg-surface p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold">Need to press a key?</summary>
              <p className="mt-2 text-xs text-muted">
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
                    className="min-h-11 rounded-lg! font-mono text-lg font-semibold"
                  >
                    {dtmfPending === digit ? "…" : digit}
                  </Button>
                ))}
              </div>
              {sentDigits ? (
                <p className="mt-2 font-mono text-xs text-muted" aria-label="Sent digits">
                  Sent: {sentDigits}
                </p>
              ) : null}
              {dtmfError ? (
                <p className="mt-2 text-sm text-danger" role="alert">
                  {dtmfError}
                </p>
              ) : null}
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
