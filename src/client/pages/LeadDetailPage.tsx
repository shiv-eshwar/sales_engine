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
        <div className="mt-8">
          <EmptyState
            icon="leads"
            title={EMPTY_COPY.leadUnspecified.title}
            description={EMPTY_COPY.leadUnspecified.description}
            action={
              <Link to="/leads" className="text-sm font-medium underline underline-offset-2">
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
        <div className="mt-8">
          <EmptyState
            icon="leads"
            title={EMPTY_COPY.leadMissing.title}
            description={`${decodedId} is not in this campaign queue. It may have been called, skipped, or filtered by the campaign tag.`}
            action={
              <Link to="/leads" className="text-sm font-medium underline underline-offset-2">
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
    <div>
      <Breadcrumbs items={crumbs} />
      <div className="mt-4">
        <ReadyContactCard
          lead={lead}
          campaign={campaign}
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
      </div>

      {lead.enrichment ? (
        <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Context</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{lead.enrichment}</p>
        </details>
      ) : null}

      {(campaign?.requiredQuestions.length ?? 0) > 0 ? (
        <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Questions</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
            {(campaign?.requiredQuestions ?? []).map((question) => (
              <li key={question.id}>
                {question.prompt}
                {question.required ? " (priority)" : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {campaign?.brief ? (
        <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Prep</summary>
          {preparing ? (
            <div className="mt-3">
              <LoadingSkeleton
                title={`Researching ${lead.company || "the company"}…`}
                detail={`Preparing questions for ${lead.fullName || "this prospect"}. This can take a minute or two.`}
                lines={4}
              />
            </div>
          ) : null}
          {prepError ? <p role="alert" className="mt-3 text-sm text-red-700">{prepError}</p> : null}
          {preparation ? <ProspectBrief preparation={preparation} /> : null}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            isDisabled={preparing || pending}
            onPress={regeneratePrep}
          >
            {prepError ? "Retry preparation" : "Regenerate brief"}
          </Button>
        </details>
      ) : null}

        <Link to="/leads" className="mt-4 inline-block text-sm text-indigo-800 underline">
          Back to ready
        </Link>
    </div>
  );
}
