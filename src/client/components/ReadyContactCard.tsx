import { useEffect, type RefObject } from "react";
import { Alert, Button, Card } from "@heroui/react";
import type { PublicCampaign, PublicLead } from "../../shared/contracts";

export function ReadyContactCard({
  kicker = "Next up",
  lead,
  campaign,
  opening,
  firstQuestion,
  disabledReason,
  starting,
  pending,
  callError,
  sheetBlocking,
  onCall,
  onSkip,
  onRefresh,
  callButtonRef
}: {
  kicker?: string;
  lead: PublicLead;
  campaign?: PublicCampaign;
  opening: string | null;
  firstQuestion: string | null;
  disabledReason: string | null;
  starting: boolean;
  pending: boolean;
  callError: string | null;
  sheetBlocking: boolean;
  onCall: () => void;
  onSkip: () => void;
  onRefresh: () => void;
  callButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (sheetBlocking || disabledReason || starting) return;
    callButtonRef?.current?.focus();
  }, [callButtonRef, disabledReason, sheetBlocking, starting, lead.leadId]);

  const title = [lead.role, lead.company].filter(Boolean).join(" · ");

  return (
    <Card aria-label="Next contact" className="max-w-xl rounded-lg! border-t-[3px] border-t-accent">
      <Card.Header className="gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{kicker}</p>
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight">
          {lead.fullName || "Unnamed contact"}
        </h1>
        {title ? <p className="text-sm text-muted">{title}</p> : null}
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="font-mono text-sm tabular-nums">
          {lead.phoneE164 ?? lead.phone}
          {lead.dialable ? "" : " — not dialable"}
        </p>
        {campaign?.objective ? (
          <p className="max-w-[32em] text-sm leading-relaxed text-muted">{campaign.objective}</p>
        ) : null}
        {campaign?.brief ? <p className="text-sm text-muted">Strategy v{campaign.version}</p> : null}
        {opening ? (
          <div className="rounded-lg bg-accent-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Opening</p>
            <p className="mt-2 text-sm leading-relaxed text-accent-soft-foreground">{opening}</p>
          </div>
        ) : null}
        {firstQuestion ? (
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Ask first. </span>
            {firstQuestion}
          </p>
        ) : null}
        {lead.issues.length > 0 ? (
          <ul className="text-sm font-medium text-danger">
            {lead.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        {callError ? (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{callError}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
      </Card.Content>
      <Card.Footer className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {sheetBlocking ? null : (
          <Button
            ref={callButtonRef}
            size="lg"
            className="min-w-28 rounded-lg!"
            isDisabled={Boolean(disabledReason) || pending || starting}
            isPending={starting}
            onPress={onCall}
          >
            {starting ? "Calling…" : "Call"}
          </Button>
        )}
        <Button variant="outline" className="rounded-lg!" isDisabled={pending || starting} onPress={onSkip}>
          Skip
        </Button>
        <button
          type="button"
          className="text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4"
          disabled={pending || starting}
          onClick={onRefresh}
        >
          Refresh
        </button>
        {disabledReason ? <p className="w-full text-sm text-muted">{disabledReason}</p> : null}
      </Card.Footer>
    </Card>
  );
}
