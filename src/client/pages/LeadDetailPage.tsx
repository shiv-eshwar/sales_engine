import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { useSession } from "../state/session";
import { selectLead } from "../state/api";
import { CallingPanel } from "../components/CallingPanel";
import { ProspectBrief } from "../components/ProspectBrief";
import { EmptyState } from "../components/EmptyState";
import { BriefLoading } from "../components/LoadingSkeleton";
import { ReadyContactCard } from "../components/ReadyContactCard";
import { useLeadCall } from "../state/useLeadCall";
import { EMPTY_COPY, PAGE_TITLES } from "../copy";
import { usePageTitle } from "../usePageTitle";
import { SPLIT, SPLIT_RAIL } from "../layout/shell";

export function LeadDetailPage() {
  const { leadId } = useParams();
  const { data, setError, runQueue } = useSession();
  const callButtonRef = useRef<HTMLButtonElement>(null);

  const decodedId = leadId ? decodeURIComponent(leadId) : null;
  const lead = decodedId
    ? (data.leads.find((item) => item.leadId === decodedId) ?? (data.lead?.leadId === decodedId ? data.lead : null))
    : data.lead;
  usePageTitle(PAGE_TITLES.lead(lead?.fullName));

  const {
    campaign, call, setCall, callError, starting, pending, disabledReason, sheetBlocking,
    preparation, preparing, prepError, opening, firstQuestion, onCall, onRefresh, openReview, regeneratePrep
  } = useLeadCall(lead ?? null);

  useEffect(() => {
    if (!decodedId || !data.selectedCampaignId) return;
    if (data.lead?.leadId === decodedId) return;
    if (!data.leads.some((item) => item.leadId === decodedId)) {
      setError(`Lead ${decodedId} is not eligible for this campaign`);
      return;
    }
    let cancelled = false;
    void selectLead(decodedId, data.selectedCampaignId)
      .then((result) => {
        if (cancelled) return;
        void runQueue(async () => result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not select lead");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedId, data.selectedCampaignId]);

  const hasBriefPane = Boolean(campaign?.brief);
  const regenerateAction = (
    <Button
      variant="outline"
      size="sm"
      className="min-h-11 rounded-lg! sm:min-h-0"
      isDisabled={preparing || pending}
      onPress={regeneratePrep}
    >
      {prepError ? "Retry preparation" : "Regenerate brief"}
    </Button>
  );

  if (!decodedId) {
    return (
      <div>
        <div className="mt-16">
          <EmptyState
            icon="leads"
            title={EMPTY_COPY.leadUnspecified.title}
            description={EMPTY_COPY.leadUnspecified.description}
            action={
              <Link to="/leads" className="text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4">
                Back to ready
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div>
        <div className="mt-16">
          <EmptyState
            icon="leads"
            title={EMPTY_COPY.leadMissing.title}
            description={`${decodedId} is not in this queue. It may have been called, skipped, or is no longer eligible.`}
            action={
              <Link to="/leads" className="text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4">
                Back to ready
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (call) {
    return (
      <CallingPanel
        session={call}
        recordingNotice={data.recordingNotice}
        preparation={preparation}
        opening={opening}
        firstQuestion={firstQuestion}
        onSession={setCall}
        onTerminal={() => void openReview(call.id)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5 lg:overflow-hidden">
      <div className={hasBriefPane ? SPLIT : SPLIT_RAIL}>
        <div className={SPLIT_RAIL}>
          <ReadyContactCard
            lead={lead}
            campaign={campaign}
            opening={opening}
            firstQuestion={firstQuestion}
            preparing={preparing}
            disabledReason={disabledReason}
            starting={starting}
            pending={pending}
            callError={callError}
            sheetBlocking={sheetBlocking}
            onCall={() => void onCall()}
            onRefresh={onRefresh}
            callButtonRef={callButtonRef}
          />
        </div>

        {hasBriefPane ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:overflow-hidden">
            {campaign?.brief ? (
              preparing || !preparation ? (
                <BriefLoading error={prepError} />
              ) : (
                <ProspectBrief
                  preparation={preparation}
                  error={prepError}
                  action={regenerateAction}
                />
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
