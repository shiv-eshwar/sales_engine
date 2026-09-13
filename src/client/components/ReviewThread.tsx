import { AuiIf, ComposerPrimitive, MessagePrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { SCROLL } from "../layout/shell";
import type { PublicProposal } from "../../shared/contracts";
import { REVIEW_COLUMN, REVIEW_COMPOSER } from "./reviewChatLayout";

function UserMessage() {
  return (
    <MessagePrimitive.Root className="ml-auto w-fit max-w-[min(100%,34rem)] rounded-lg bg-surface px-4 py-2.5 text-[15px] leading-relaxed text-foreground shadow-sm">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="w-full max-w-[42rem] text-[15px] leading-7 whitespace-pre-wrap text-foreground">
      <MessagePrimitive.Content />
      <MessagePrimitive.Error>
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          The review assistant could not finish that reply. Try sending again.
        </p>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}

function SuggestionChips({
  proposal,
  disabled
}: {
  proposal: PublicProposal;
  disabled?: boolean;
}) {
  const failedWrite = proposal.status === "pending_retry";
  const chip = "review-chip rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <div className="review-suggestions flex flex-wrap items-center gap-2" aria-label="Review suggestions">
      {failedWrite ? (
        <ThreadPrimitive.Suggestion
          send
          prompt="Retry the Sheet write"
          className={`${chip} bg-accent text-accent-foreground`}
          disabled={disabled}
        >
          Retry the Sheet write
        </ThreadPrimitive.Suggestion>
      ) : (
        <ThreadPrimitive.Suggestion
          send
          prompt="Write this update"
          className={`${chip} bg-accent text-accent-foreground`}
          disabled={disabled}
        >
          Write this update
        </ThreadPrimitive.Suggestion>
      )}
      {proposal.kind === "non_connect" && !failedWrite ? (
        <>
          <ThreadPrimitive.Suggestion
            send
            prompt="Retry later"
            className={`${chip} bg-surface-secondary text-muted hover:text-foreground`}
            disabled={disabled}
          >
            Retry later
          </ThreadPrimitive.Suggestion>
          <ThreadPrimitive.Suggestion
            send
            prompt="Skip this contact"
            className={`${chip} bg-surface-secondary text-muted hover:text-foreground`}
            disabled={disabled}
          >
            Skip this contact
          </ThreadPrimitive.Suggestion>
        </>
      ) : null}
    </div>
  );
}

export function ReviewThread({
  proposal,
  who,
  disabled
}: {
  proposal: PublicProposal;
  who: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="Review chat">
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className={`flex min-h-0 flex-1 flex-col ${SCROLL}`}>
          <div className={`${REVIEW_COLUMN} flex flex-col gap-6 py-5`}>
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">{who}</span>
              {" · "}
              Nothing is written until you confirm in this chat.
            </p>
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage
              }}
            />
            <AuiIf condition={(state) => !state.thread.isRunning}>
              <SuggestionChips proposal={proposal} disabled={disabled} />
            </AuiIf>
          </div>
        </ThreadPrimitive.Viewport>
        <ThreadPrimitive.ViewportFooter className="relative shrink-0 bg-transparent">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-12 h-12 bg-gradient-to-b from-transparent to-background"
          />
          <div className={`${REVIEW_COLUMN} relative pb-1 pt-1`}>
            <AuiIf condition={(state) => state.thread.isRunning}>
              <p role="status" className="mb-3 text-sm text-muted">
                Reviewing the call…
              </p>
            </AuiIf>
            <ComposerPrimitive.Root className={REVIEW_COMPOSER}>
              <ComposerPrimitive.Input
                aria-label="Review message"
                placeholder="Message the review assistant…"
                className="min-h-11 min-w-0 w-full flex-1 bg-transparent"
                disabled={disabled}
              />
              <ComposerPrimitive.Send
                aria-label="Send"
                className="review-send min-h-10 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50"
                disabled={disabled}
              >
                Send
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Root>
    </div>
  );
}
