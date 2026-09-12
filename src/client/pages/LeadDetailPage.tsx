import { useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { useSession } from "../state/session";
import { selectLead } from "../state/api";
import { CallingPanel } from "../components/CallingPanel";
import { ProspectBrief } from "../components/ProspectBrief";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState } from "../components/EmptyState";
import { BriefLoading } from "../components/LoadingSkeleton";
import { ReadyContactCard } from "../components/ReadyContactCard";
import { useLeadCall } from "../state/useLeadCall";
import { EMPTY_COPY } from "../copy";
import { Icon } from "../components/Icon";
import { SPLIT, SPLIT_RAIL } from "../layout/shell";

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
        <Breadcrumbs items={[{ label: "Ready", to: "/leads" }, { label: decodedId }]} />
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
        onSession={setCall}
        onTerminal={() => void openReview(call.id)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={crumbs} />
      <div className={campaign?.brief || lead.enrichment || (campaign?.requiredQuestions.length ?? 0) > 0 ? SPLIT : undefined}>
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
            onSkip={() => void onSkip()}
            onRefresh={onRefresh}
            callButtonRef={callButtonRef}
          />
          <Link
            to="/leads"
            className="mt-6 inline-block w-fit text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4"
          >
            Back to ready
          </Link>
        </div>

        {campaign?.brief || lead.enrichment || (campaign?.requiredQuestions.length ?? 0) > 0 ? (
          <div className="flex min-w-0 flex-col gap-8">
            {campaign?.brief ? (
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <p className="text-sm font-semibold">Prep</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg!"
                    isDisabled={preparing || pending}
                    onPress={regeneratePrep}
                  >
                    {prepError ? "Retry preparation" : "Regenerate brief"}
                  </Button>
                </div>
                {prepError ? <p role="alert" className="mt-4 text-sm font-medium text-danger">{prepError}</p> : null}
                <div className="mt-6">
                  {preparation ? (
                    <div
                      className={`transition-opacity duration-500 ease-out ${preparing ? "opacity-60" : "opacity-100"}`}
                    >
                      <ProspectBrief preparation={preparation} />
                    </div>
                  ) : (
                    <BriefLoading
                      title={`Researching ${lead.company || "the company"}…`}
                      detail={`Preparing questions for ${lead.fullName || "this prospect"}. This can take a minute or two.`}
                    />
                  )}
                </div>
              </section>
            ) : null}

            {lead.enrichment || (campaign?.requiredQuestions.length ?? 0) > 0 ? (
              <div className="flex flex-col gap-3">
                {lead.enrichment ? (
                  <details>
                    <summary className="cursor-pointer py-1 text-sm font-semibold">Context</summary>
                    <p className="mt-4 max-w-[32em] whitespace-pre-wrap text-sm leading-relaxed text-muted">{lead.enrichment}</p>
                  </details>
                ) : null}

                {(campaign?.requiredQuestions.length ?? 0) > 0 ? (
                  <details>
                    <summary className="cursor-pointer py-1 text-sm font-semibold">Questions</summary>
                    <ul className="mt-4 space-y-3 text-sm">
                      {(campaign?.requiredQuestions ?? []).map((question) => (
                        <li key={question.id} className="flex items-start gap-2">
                          {question.required ? <Icon name="flag" className="mt-0.5 text-accent" title="Priority" /> : null}
                          <span>{question.prompt}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
