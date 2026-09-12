import { useEffect, type RefObject } from "react";
import { Alert, Button, Card } from "@heroui/react";
import type { PublicCampaign, PublicLead } from "../../shared/contracts";
import { Icon, QuoteMark } from "./Icon";

export function ReadyContactCard({
  lead,
  campaign,
  opening,
  firstQuestion,
  preparing = false,
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
  preparing?: boolean;
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
    if (sheetBlocking || disabledReason || starting || preparing) return;
    callButtonRef?.current?.focus();
  }, [callButtonRef, disabledReason, preparing, sheetBlocking, starting, lead.leadId]);

  const extraIssues = lead.issues.filter((issue) => issue !== "Phone is not dialable");

  return (
    <Card aria-label="Next contact" className="w-full rounded-lg! border-t-[3px] border-t-accent">
      <Card.Header className="flex flex-col items-start gap-1 px-8 pt-8 pb-0">
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight">
          {lead.fullName || "Unnamed contact"}
        </h1>
        {lead.role ? <p className="text-sm text-muted">{lead.role}</p> : null}
        {lead.company ? <p className="text-sm text-muted">{lead.company}</p> : null}
        <p className="mt-1 flex items-center gap-2 text-sm">
          <Icon
            name={lead.dialable ? "phone" : "phoneOff"}
            className={lead.dialable ? "text-muted" : "text-danger"}
            title={lead.dialable ? undefined : "Not dialable"}
          />
          <span className="font-mono tabular-nums">{lead.phoneE164 ?? lead.phone}</span>
        </p>
      </Card.Header>
      <Card.Content className="gap-8 px-8 pt-8 pb-8">
        {campaign?.objective ? (
          <div className="flex flex-col gap-2">
            <p className="max-w-[32em] text-sm leading-relaxed text-muted">{campaign.objective}</p>
            {campaign.brief ? <p className="text-sm text-muted">Strategy v{campaign.version}</p> : null}
          </div>
        ) : campaign?.brief ? (
          <p className="text-sm text-muted">Strategy v{campaign.version}</p>
        ) : null}
        {campaign?.brief || opening || preparing ? (
          <div
            className="relative min-h-[14rem] rounded-lg bg-accent-soft px-6 py-6 transition-opacity duration-300"
            role={preparing ? "status" : undefined}
            aria-label={preparing ? "Preparing opening" : undefined}
            style={{ opacity: preparing ? 0.72 : 1 }}
          >
            <QuoteMark />
            <div className="relative mt-3">
              <div
                className={`space-y-3 transition-opacity duration-300 ${
                  opening ? "pointer-events-none absolute inset-0 opacity-0" : "opacity-100"
                }`}
                aria-hidden={Boolean(opening)}
              >
                <div className="h-3 w-full animate-pulse rounded-full bg-accent/15" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-accent/15" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-accent/15" />
              </div>
              {opening ? (
                <p className="text-sm leading-relaxed text-accent-soft-foreground">{opening}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="min-h-[3rem]">
          {firstQuestion ? (
            <p className="max-w-[32em] text-sm leading-relaxed">{firstQuestion}</p>
          ) : preparing ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-3 w-full animate-pulse rounded-full bg-surface-secondary" />
              <div className="h-3 w-4/5 animate-pulse rounded-full bg-surface-secondary" />
            </div>
          ) : null}
        </div>
        {extraIssues.length > 0 ? (
          <ul className="text-sm font-medium text-danger">
            {extraIssues.map((issue) => (
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
      <Card.Footer className="flex flex-wrap items-center gap-x-5 gap-y-4 px-8 pb-8 pt-0">
        {sheetBlocking ? null : (
          <Button
            ref={callButtonRef}
            size="lg"
            className="min-w-28 rounded-lg!"
            isDisabled={Boolean(disabledReason) || pending || starting || preparing}
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
