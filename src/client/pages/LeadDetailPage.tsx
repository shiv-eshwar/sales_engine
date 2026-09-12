import { useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { useSession } from "../state/session";
import { selectLead } from "../state/api";
import { CallingPanel } from "../components/CallingPanel";
import { ProspectBrief } from "../components/ProspectBrief";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState } from "../components/EmptyState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { ReadyContactCard } from "../components/ReadyContactCard";
import { useLeadCall } from "../state/useLeadCall";
import { EMPTY_COPY } from "../copy";

export function LeadDetailPage() {
  const { leadId } = useParams();
  const { data, setError, runQueue, liveCall } = useSession();
  const callButtonRef = useRef<HTMLButtonElement>(null);

  const decodedId = leadId ? decodeURIComponent(leadId) : null;
  const lead = decodedId
    ? (data.leads.find((item) => item.leadId === decodedId) ?? (data.lead?.leadId === decodedId ? data.lead : null))
    : data.lead;

  const {
    campaign, call, setCall, callError, starting, pending, disabledReason, sheetBlocking,
    preparation, preparing, prepError, opening, firstQuestion, onCall, onSkip, onRefresh, openReview, regeneratePrep
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

  const crumbs = useMemo(
    () => [
      { label: "Ready", to: liveCall ? undefined : "/leads" },
      { label: lead?.fullName || decodedId || "Lead" }
    ],
    [decodedId, lead?.fullName, liveCall]
  );

  if (!decodedId) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Ready", to: "/leads" }, { label: "Lead" }]} />
        <div className="mt-10">
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
        <Breadcrumbs items={[{ label: "Ready", to: "/leads" }, { label: decodedId }]} />
        <div className="mt-10">
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
        onSession={setCall}
        onTerminal={() => void openReview(call.id)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={crumbs} />
        <ReadyContactCard
        lead={lead}
        campaign={campaign}
        kicker="Contact"
        opening={opening}
        firstQuestion={firstQuestion}
        disabledReason={disabledReason}
        starting={starting}
        pending={pending}
        callError={callError}
        sheetBlocking={sheetBlocking}
        onCall={() => void onCall()}
        onSkip={() => void onSkip()}
        onRefresh={onRefresh}
        callButtonRef={callButtonRef}
      />

      {lead.enrichment ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Context</summary>
          <p className="mt-3 max-w-[32em] whitespace-pre-wrap text-sm leading-relaxed text-muted">{lead.enrichment}</p>
        </details>
      ) : null}

      {(campaign?.requiredQuestions.length ?? 0) > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Questions</summary>
          <ul className="mt-3 max-w-xl space-y-2 text-sm">
            {(campaign?.requiredQuestions ?? []).map((question) => (
              <li key={question.id}>
                {question.prompt}
                {question.required ? <span className="text-sm text-muted"> · priority</span> : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {campaign?.brief ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Prep</summary>
          {preparing ? (
            <div className="mt-4">
              <LoadingSkeleton
                title={`Researching ${lead.company || "the company"}…`}
                detail={`Preparing questions for ${lead.fullName || "this prospect"}. This can take a minute or two.`}
                lines={4}
              />
            </div>
          ) : null}
          {prepError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{prepError}</p> : null}
          {preparation ? <ProspectBrief preparation={preparation} /> : null}
          <Button
            variant="outline"
            size="sm"
            className="mt-4 rounded-lg!"
            isDisabled={preparing || pending}
            onPress={regeneratePrep}
          >
            {prepError ? "Retry preparation" : "Regenerate brief"}
          </Button>
        </details>
      ) : null}

      <Link to="/leads" className="w-fit text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4">
        Back to ready
      </Link>
    </div>
  );
}
