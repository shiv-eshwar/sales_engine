import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive
} from "@assistant-ui/react";
import { Alert } from "@heroui/react";

function UserMessage() {
  return (
    <MessagePrimitive.Root className="ml-auto max-w-[85%] rounded-2xl bg-accent px-3 py-2 text-sm text-accent-foreground">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide opacity-80">You</p>
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="bg-surface-secondary text-foreground mr-auto max-w-[85%] rounded-2xl px-3 py-2 text-sm">
      <p className="text-muted mb-1 text-[11px] font-medium uppercase tracking-wide">Assistant</p>
      <MessagePrimitive.Content />
      <MessagePrimitive.Error>
        <p role="alert" className="text-danger mt-2 text-sm">
          The assistant could not finish that reply. Try sending again.
        </p>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}

export function CampaignThread({
  disabled,
  disabledReason
}: {
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Campaign chat">
      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
        <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage
            }}
          />
        </ThreadPrimitive.Viewport>
        <ThreadPrimitive.ViewportFooter className="border-t border-separator bg-background pt-3">
          {disabledReason ? (
            <Alert status="warning" className="mb-3">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{disabledReason}</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : null}
          <AuiIf condition={(state) => state.thread.isRunning}>
            <p role="status" className="mb-2 text-sm text-muted">
              Creating your strategy. This may take a minute.
            </p>
          </AuiIf>
          <ComposerPrimitive.Root className="flex items-end gap-2">
            <ComposerPrimitive.Input
              aria-label="Campaign message"
              placeholder="Message the campaign assistant…"
              className="border-separator bg-surface text-foreground min-h-16 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              disabled={disabled}
            />
            <ComposerPrimitive.Send
              aria-label="Send"
              className="button button--primary button--md"
              disabled={disabled}
            >
              Send
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Root>
    </div>
  );
}
