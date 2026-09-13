import { useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage
} from "@assistant-ui/react";
import { Alert } from "@heroui/react";
import type { PublicProposal } from "../../shared/contracts";
import { openingReviewMessage } from "../../shared/reviewOpening";
import { interviewReview, type ReviewInterviewResponse } from "../state/api";
import { nextLeadPath } from "../copy";
import { ReviewThread } from "./ReviewThread";
import { REVIEW_COLUMN } from "./reviewChatLayout";
import "./ReviewChat.css";

function textFromMessage(message: ThreadMessage): string {
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function ReviewChat({
  proposal,
  pending,
  error,
  onProposal,
  onFinished
}: {
  proposal: PublicProposal;
  pending: boolean;
  error: string | null;
  onProposal: (proposal: PublicProposal) => void;
  onFinished: (path: string, result: ReviewInterviewResponse) => void | Promise<void>;
}) {
  const proposalRef = useRef(proposal);
  proposalRef.current = proposal;
  const onProposalRef = useRef(onProposal);
  onProposalRef.current = onProposal;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const [chatError, setChatError] = useState<string | null>(null);
  const dnc = proposal.semanticOutcome === "do_not_contact" || proposal.proposedFields.call_status === "Do Not Contact";
  const failedWrite = proposal.status === "pending_retry";
  const who = proposal.contactName.trim() || proposal.leadId;

  const adapter = useMemo<ChatModelAdapter>(() => ({
    async run({ messages, abortSignal }) {
      const payload = messages
        .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
        .map((message) => ({ role: message.role, content: textFromMessage(message) }))
        .filter((message) => message.content.length > 0);
      setChatError(null);
      try {
        const result = await interviewReview({
          sessionId: proposalRef.current.sessionId,
          messages: payload,
          signal: abortSignal
        });
        onProposalRef.current(result.proposal);
        if (result.leftReview) {
          const next = result.leads.find((item) => item.dialable) ?? result.lead ?? null;
          await onFinishedRef.current(
            result.proposal.status === "discarded" ? "/leads" : nextLeadPath(next),
            result
          );
        }
        return { content: [{ type: "text", text: result.text }] };
      } catch (caught) {
        const text = caught instanceof Error ? caught.message : "Review chat failed. Try again.";
        setChatError(text);
        return { content: [{ type: "text", text }] };
      }
    }
  }), []);

  const runtime = useLocalRuntime(adapter, {
    initialMessages: [
      {
        role: "assistant",
        content: [{ type: "text", text: openingReviewMessage(proposal) }]
      }
    ]
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <section className="review-chat flex min-h-0 flex-1 flex-col" aria-label="Call review">
        <h1 className="sr-only">{who}</h1>

        {dnc || proposal.warnings.length > 0 || failedWrite || error || chatError ? (
          <div className={`${REVIEW_COLUMN} mt-3 flex shrink-0 flex-col gap-3`}>
            {dnc ? (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Do not contact. Confirming the write suppresses this lead so it will not return to the queue.</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}

            {proposal.warnings.length > 0 ? (
              <Alert status="warning" aria-label="Warnings">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    {proposal.warnings.join(" ")}
                  </Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}

            {failedWrite ? (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Sheet write failed and is waiting for retry. {proposal.lastError}</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}

            {error || chatError ? (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{error ?? chatError}</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <ReviewThread proposal={proposal} who={who} disabled={pending} />
      </section>
    </AssistantRuntimeProvider>
  );
}
