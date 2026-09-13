import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import type { CalendarConnectionStatus, PublicCoachMessage } from "../../shared/contracts";
import { CalendarEventCard } from "./CalendarEventCard";
import { REVIEW_COMPOSER } from "./reviewChatLayout";
import { SCROLL } from "../layout/shell";

export function CoachThread({
  messages,
  connected,
  interrupted,
  calendar,
  pending,
  onSend,
  onProposal
}: {
  messages: PublicCoachMessage[];
  connected: boolean;
  interrupted: boolean;
  calendar: CalendarConnectionStatus;
  pending: boolean;
  onSend: (text: string) => Promise<void>;
  onProposal: (id: string, next: PublicCoachMessage["calendarProposal"]) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastAssistantId = [...messages].reverse().find((item) => item.role === "assistant")?.id;

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  async function submit() {
    const text = draft.trim();
    if (!text || pending || !connected) return;
    setDraft("");
    await onSend(text);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="Coach thread">
      <div ref={listRef} className={`min-h-0 flex-1 space-y-4 ${SCROLL} pr-1`}>
        {interrupted ? (
          <p className="text-sm text-muted">Cue hidden while transcription is interrupted.</p>
        ) : null}
        {!connected ? (
          <p className="text-sm text-muted">Waiting for the call…</p>
        ) : messages.length === 0 && !interrupted ? (
          <p className="text-sm text-muted">Coach is listening.</p>
        ) : null}
        {messages.map((message) => {
          const latest = message.role === "assistant" && message.id === lastAssistantId;
          if (message.role === "user") {
            return (
              <div
                key={message.id}
                className="ml-auto w-fit max-w-[min(100%,22rem)] rounded-lg bg-surface px-3.5 py-2 text-sm leading-relaxed shadow-sm"
              >
                {message.text}
              </div>
            );
          }
          return (
            <div key={message.id} className="space-y-3">
              {message.text ? (
                <p
                  className={
                    latest
                      ? "text-xl font-semibold leading-snug tracking-tight sm:text-2xl"
                      : "text-sm leading-relaxed text-muted"
                  }
                >
                  {message.text}
                </p>
              ) : null}
              {message.calendarProposal ? (
                <CalendarEventCard
                  proposal={message.calendarProposal}
                  calendar={calendar}
                  onProposal={(next) => onProposal(message.id, next)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <form
        className={`mt-3 ${REVIEW_COMPOSER}`}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          aria-label="Message the coach"
          placeholder={connected ? "Steer the coach…" : "Waiting for the call…"}
          className="min-h-11 min-w-0 w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          value={draft}
          disabled={!connected || pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <Button type="submit" className="min-h-10 shrink-0 rounded-lg!" isDisabled={!connected || pending || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
