import { useEffect, type RefObject } from "react";
import { Alert, Button, Card } from "@heroui/react";
import type { PublicCampaign, PublicLead } from "../../shared/contracts";
import { Icon, QuoteMark } from "./Icon";
import { SCROLL } from "../layout/shell";

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
  onSkip?: () => void;
  onRefresh: () => void;
  callButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (sheetBlocking || disabledReason || starting || preparing) return;
    callButtonRef?.current?.focus({ preventScroll: true });
  }, [callButtonRef, disabledReason, preparing, sheetBlocking, starting, lead.leadId]);

  const extraIssues = lead.issues.filter((issue) => issue !== "Phone is not dialable");

  return (
    <Card aria-label="Next contact" className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col gap-0! overflow-hidden! rounded-lg! border-t-[3px] border-t-accent p-0! max-lg:pb-[5.5rem]">
      <Card.Header className="relative z-20 flex min-w-0 shrink-0 flex-col items-start gap-1 bg-surface px-5 pt-5 sm:px-8 sm:pt-8">
        <h1 className="text-xl font-semibold leading-[1.15] tracking-tight break-words sm:text-2xl">
          {lead.fullName || "Unnamed contact"}
        </h1>
        {lead.role ? <p className="text-sm text-muted break-words">{lead.role}</p> : null}
        {lead.company ? <p className="text-sm text-muted break-words">{lead.company}</p> : null}
        <p className="mt-1 flex min-w-0 items-center gap-2 text-sm">
          <Icon
            name={lead.dialable ? "phone" : "phoneOff"}
            className={lead.dialable ? "text-muted" : "text-danger"}
            title={lead.dialable ? undefined : "Not dialable"}
          />
          <span className="min-w-0 font-mono tabular-nums break-all">{lead.phoneE164 ?? lead.phone}</span>
        </p>
      </Card.Header>
      <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className={`h-full min-h-0 ${SCROLL} px-5 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-8`}>
        <div className="flex min-h-min min-w-0 flex-col gap-5 sm:gap-8">
        {campaign?.objective ? (
          <div className="flex min-w-0 flex-col gap-2">
            <p className="max-w-[32em] text-sm leading-relaxed text-muted line-clamp-3 sm:line-clamp-none">{campaign.objective}</p>
            {campaign.brief ? <p className="text-sm text-muted">Strategy v{campaign.version}</p> : null}
          </div>
        ) : campaign?.brief ? (
          <p className="text-sm text-muted">Strategy v{campaign.version}</p>
        ) : null}
        {campaign?.brief || opening || preparing ? (
          <div
            className="max-h-[12.5rem] min-h-[4.75rem] min-w-0 overflow-hidden rounded-lg bg-accent-soft"
            role={preparing ? "status" : undefined}
            aria-label={preparing ? "Preparing opening" : undefined}
            style={preparing ? { opacity: 0.72 } : undefined}
          >
            <div className={`max-h-[12.5rem] ${SCROLL} px-5 py-5 sm:px-6 sm:py-6`}>
            <QuoteMark />
            {opening ? (
              <p className="mt-3 text-sm leading-relaxed break-words text-accent-soft-foreground">{opening}</p>
            ) : (
              <div className="mt-3 space-y-3" aria-hidden="true">
                <div className="h-3 w-full animate-pulse rounded-full bg-accent/15" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-accent/15" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-accent/15" />
              </div>
            )}
            </div>
          </div>
        ) : null}
        <div className="min-w-0">
          {firstQuestion ? (
            <p className="max-w-[32em] text-sm leading-relaxed break-words">{firstQuestion}</p>
          ) : preparing ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-3 w-full animate-pulse rounded-full bg-surface-secondary" />
              <div className="h-3 w-4/5 animate-pulse rounded-full bg-surface-secondary" />
            </div>
          ) : null}
        </div>
        {extraIssues.length > 0 ? (
          <ul className="min-w-0 text-sm font-medium text-danger">
            {extraIssues.map((issue) => (
              <li key={issue} className="break-words">{issue}</li>
            ))}
          </ul>
        ) : null}
        {callError ? (
          <Alert status="danger" role="alert" className="min-w-0">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{callError}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
        </div>
        </div>
      </div>
      <Card.Footer className="relative z-20 isolate mt-auto flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 bg-surface! px-5 py-4 shadow-[0_-8px_24px_-12px_hsl(220_20%_12%/0.12)] sm:gap-x-5 sm:px-8 sm:pb-8 sm:pt-4 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:px-[max(1.25rem,env(safe-area-inset-left))] max-lg:pr-[max(1.25rem,env(safe-area-inset-right))] max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:pt-4">
        {sheetBlocking ? null : (
          <Button
            ref={callButtonRef}
            size="lg"
            className="min-h-11 min-w-28 rounded-lg!"
            isDisabled={Boolean(disabledReason) || pending || starting || preparing}
            isPending={starting}
            onPress={onCall}
          >
            {starting ? "Calling…" : "Call"}
          </Button>
        )}
        {onSkip ? (
          <Button variant="outline" className="min-h-11 rounded-lg!" isDisabled={pending || starting} onPress={onSkip}>
            Skip
          </Button>
        ) : null}
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4"
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
