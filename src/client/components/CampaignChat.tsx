import { useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage
} from "@assistant-ui/react";
import { Alert } from "@heroui/react";
import type { PublicCampaign } from "../../shared/contracts";
import { interviewCampaign } from "../state/api";
import { CampaignThread } from "./CampaignThread";

function textFromMessage(message: ThreadMessage): string {
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function CampaignChat({
  campaign,
  requestId,
  onSaved,
  onBusy,
  aiMessage
}: {
  campaign?: PublicCampaign;
  requestId: string;
  onSaved: (campaign: PublicCampaign) => Promise<void>;
  onBusy: (busy: boolean) => void;
  aiMessage?: string;
}) {
  const onSavedRef = useRef(onSaved);
  const onBusyRef = useRef(onBusy);
  onSavedRef.current = onSaved;
  onBusyRef.current = onBusy;
  const [error, setError] = useState<string | null>(null);

  const welcome = campaign
    ? `You're editing ${campaign.name}. What should change about the offering, audience, or call goal?`
    : "Your leads Sheet is connected. What are you selling, who is it for, and what should this call achieve?";

  const adapter = useMemo<ChatModelAdapter>(() => ({
    async run({ messages, abortSignal }) {
      if (aiMessage) {
        return { content: [{ type: "text", text: aiMessage }] };
      }
      const payload = messages
        .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
        .map((message) => ({ role: message.role, content: textFromMessage(message) }))
        .filter((message) => message.content.length > 0);
      onBusyRef.current(true);
      setError(null);
      try {
        const result = await interviewCampaign({
          messages: payload,
          requestId,
          campaignId: campaign?.id,
          signal: abortSignal
        });
        if (result.campaign) {
          await onSavedRef.current(result.campaign);
        }
        return { content: [{ type: "text", text: result.text }] };
      } catch (error) {
        const text = error instanceof Error ? error.message : "Campaign generation failed. Try again.";
        setError(text);
        return { content: [{ type: "text", text }] };
      } finally {
        onBusyRef.current(false);
      }
    }
  }), [aiMessage, campaign?.id, requestId]);

  const runtime = useLocalRuntime(adapter, {
    initialMessages: [
      {
        role: "assistant",
        content: [{ type: "text", text: welcome }]
      }
    ]
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {error ? (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
        <div className="min-h-0 flex-1">
          <CampaignThread disabled={Boolean(aiMessage)} disabledReason={aiMessage} />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
