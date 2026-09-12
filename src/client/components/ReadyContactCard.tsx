import { useEffect, type RefObject } from "react";
import { Alert, Button, Card } from "@heroui/react";
import type { PublicCampaign, PublicLead } from "../../shared/contracts";

export function ReadyContactCard({
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

  return (
    <Card aria-label="Next contact">
      <Card.Header>
        <p className="text-muted text-xs font-medium uppercase tracking-wide">Next up</p>
        <Card.Title className="text-2xl tracking-tight">{lead.fullName || "Unnamed contact"}</Card.Title>
        <Card.Description>
          {lead.role}
          {lead.role && lead.company ? " · " : ""}
          {lead.company}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <p className="font-mono text-sm">
          {lead.phoneE164 ?? lead.phone}
          {lead.dialable ? "" : " — not dialable"}
        </p>
        {campaign ? (
          <p className="mt-3 text-sm">
            {campaign.objective}
            {campaign.brief ? <span className="text-muted mt-1 block text-xs">Strategy v{campaign.version}</span> : null}
          </p>
        ) : null}
        {opening ? (
          <div className="bg-surface-secondary mt-4 rounded-md p-3">
            <h2 className="text-muted text-xs font-medium uppercase tracking-wide">Opening</h2>
            <p className="mt-1 text-sm leading-relaxed">{opening}</p>
          </div>
        ) : null}
        {firstQuestion ? (
          <p className="mt-3 text-sm">
            <span className="font-medium">First question: </span>
            {firstQuestion}
          </p>
        ) : null}
        {lead.issues.length > 0 ? (
          <ul className="text-danger mt-3 text-sm">
            {lead.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        {callError ? (
          <Alert status="danger" className="mt-3" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{callError}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
      </Card.Content>
      <Card.Footer className="flex flex-wrap items-center gap-3">
        {sheetBlocking ? null : (
          <Button
            ref={callButtonRef}
            size="lg"
            className="px-8 text-lg font-semibold"
            isDisabled={Boolean(disabledReason) || pending || starting}
            isPending={starting}
            onPress={onCall}
          >
            {starting ? "Calling…" : "Call"}
          </Button>
        )}
        <Button variant="outline" isDisabled={pending || starting} onPress={onSkip}>
          Skip
        </Button>
        <Button
          variant="outline"
          isDisabled={pending || starting}
          onPress={onRefresh}
        >
          Refresh
        </Button>
        {disabledReason ? <p className="text-muted text-sm">{disabledReason}</p> : null}
      </Card.Footer>
    </Card>
  );
}
