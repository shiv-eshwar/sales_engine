import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ProspectPreparation } from "../../shared/campaigns";
import { useSession } from "../state/session";
import { finalizeCall, prepareLead, refreshLeads, selectLead } from "../state/api";
import {
  callDisabledReason,
  cancelCallSession,
  createCallSession,
  fetchCallSession,
  type CallSessionView
} from "../state/calls";
import { connectTwilioCall, hangUpTwilioCall } from "../twilio/device";
import { CallingPanel } from "../components/CallingPanel";
import { ProspectBrief } from "../components/ProspectBrief";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { LoadingSkeleton } from "../components/LoadingSkeleton";

export function LeadDetailPage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const {
    data, pending, setError, runQueue, handleSkipLead,
    deviceStatus, setReview
  } = useSession();
  const [call, setCall] = useState<CallSessionView | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [prepState, setPrepState] = useState<{ key: string; result: ProspectPreparation | null; error: string | null; loading: boolean } | null>(null);
  const [prepRefresh, setPrepRefresh] = useState<{ key: string; attempt: number } | null>(null);

  const campaign = useMemo(
    () => data.campaigns.find((item) => item.id === data.selectedCampaignId) ?? data.campaigns[0],
    [data.campaigns, data.selectedCampaignId]
  );
  const decodedId = leadId ? decodeURIComponent(leadId) : null;
  const lead = decodedId ? (data.leads.find((item) => item.leadId === decodedId) ?? (data.lead?.leadId === decodedId ? data.lead : null)) : data.lead;
  const twilioConfigured = data.twilio.status === "ok";
  const callActive = Boolean(call);

  // Sync server-side selected lead when landing directly on a deep link.
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

  const prepKey = campaign?.brief && lead
    ? JSON.stringify([campaign.id, campaign.version, lead.leadId, lead.company, lead.fullName, lead.role, lead.enrichment])
    : "";
  const preparation = prepState?.key === prepKey ? prepState.result : null;
  const prepError = prepState?.key === prepKey ? prepState.error : null;
  const preparing = Boolean(prepKey && (prepState?.key !== prepKey || prepState.loading));
  const refreshAttempt = prepRefresh?.key === prepKey ? prepRefresh.attempt : 0;

  const disabledReason = !campaign
    ? "Create a campaign first"
    : campaign.brief && (!preparation || preparing)
      ? preparing ? "Preparing research and call brief…" : "Generate a call brief before calling"
      : callDisabledReason({
        twilioConfigured,
        deviceStatus,
        lead: lead ?? null,
        callActive,
        sheetStatus: data.sheet.status
      });
  const sheetBlocking = data.sheet.status === "error" || data.sheet.status === "unconfigured";

  useEffect(() => {
    if (!prepKey || !campaign || !lead || callActive) return;
    const controller = new AbortController();
    setPrepState({ key: prepKey, result: null, error: null, loading: true });
    void prepareLead(campaign.id, lead.leadId, refreshAttempt > 0, controller.signal).then((result) => {
      if (!controller.signal.aborted) setPrepState({ key: prepKey, result, error: null, loading: false });
    }).catch((err) => {
      if (!controller.signal.aborted) setPrepState({ key: prepKey, result: null, error: err instanceof Error ? err.message : "Preparation failed", loading: false });
    });
    return () => controller.abort();
  }, [prepKey, refreshAttempt, callActive, campaign, lead]);

  async function onCall() {
    if (!lead || !data.selectedCampaignId || disabledReason) return;
    setStarting(true);
    setCallError(null);
    try {
      const session = await createCallSession(lead.leadId, data.selectedCampaignId, preparation?.id);
      setCall(session);
      try {
        await connectTwilioCall(session.id);
      } catch (connectError) {
        await cancelCallSession(session.id);
        try {
          setReview(await finalizeCall(session.id));
          navigate(`/calls/${session.id}/review`);
          return;
        } catch {
          setCall(null);
        }
        setCall(null);
        throw connectError;
      }
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Could not start call");
    } finally {
      setStarting(false);
    }
  }

  async function openReview(sessionId: string) {
    hangUpTwilioCall();
    try {
      const proposal = await finalizeCall(sessionId);
      setReview(proposal);
      setCall(null);
      navigate(`/calls/${sessionId}/review`);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Could not prepare review");
      setCall(null);
    }
  }

  // Polling + terminal handling lives in CallingPanel; this keeps the page in sync.
  useEffect(() => {
    if (!call || call.status !== "in_progress") return undefined;
    const timer = window.setInterval(() => {
      void fetchCallSession(call.id).then(setCall).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [call]);

  if (!decodedId) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Leads", to: "/leads" }, { label: "Lead" }]} />
        <p className="mt-3 text-slate-700">No lead selected.</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Leads", to: "/leads" }, { label: decodedId ?? "Lead" }]} />
        <h1 className="mt-3 text-2xl font-semibold">Lead not found</h1>
        <p className="mt-1 text-sm text-slate-600">
          {decodedId} is not in this campaign queue. It may have been called, skipped, or filtered by the campaign tag.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Leads", to: "/leads" }, { label: lead.fullName || lead.leadId }]} />

      {call ? (
        <div className="mt-4">
          <CallingPanel
            session={call}
            recordingNotice={data.recordingNotice}
            onSession={setCall}
            onTerminal={() => void openReview(call.id)}
          />
        </div>
      ) : (
        <>
          <section className="mt-4 grid gap-6 lg:grid-cols-5">
            <article className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-3" aria-label="Contact">
              <h1 className="text-2xl font-semibold">{lead.fullName || "Unnamed contact"}</h1>
              <p className="text-sm text-slate-700">
                {lead.role}{lead.role && lead.company ? " · " : ""}{lead.company}
              </p>
              <p className="mt-2 font-mono text-sm">
                {lead.phoneE164 ?? lead.phone}
                {lead.dialable ? "" : " — not dialable"}
              </p>
              {lead.issues.length > 0 ? (
                <ul className="mt-2 text-sm text-red-700">
                  {lead.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4">
                <h2 className="text-sm font-medium">Enrichment</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{lead.enrichment || "None"}</p>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Status: {[lead.callStatus, lead.crmStatus].filter(Boolean).join(" · ") || "—"} · ID {lead.leadId}
              </p>
            </article>

            <aside className="space-y-4 lg:col-span-2">
              <section className="rounded-lg border border-slate-200 bg-white p-5" aria-label="Call actions">
                <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Call this lead</h2>
                {campaign ? (
                  <p className="mt-2 text-sm text-slate-800">
                    {campaign.objective}
                    {campaign.brief ? <span className="mt-1 block text-xs text-slate-500">Strategy v{campaign.version}</span> : null}
                  </p>
                ) : <p className="mt-2 text-sm">No campaign loaded.</p>}
                {callError ? <p role="alert" className="mt-2 text-sm text-red-700">{callError}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {sheetBlocking ? null : (
                    <button
                      type="button"
                      disabled={Boolean(disabledReason) || pending || starting}
                      title={disabledReason ?? "Start a call"}
                      className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:bg-slate-300 disabled:text-slate-600"
                      onClick={() => void onCall()}
                    >
                      {starting ? "Calling…" : "Call"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending || starting}
                    className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
                    onClick={() => {
                      void (async () => {
                        await handleSkipLead(lead.leadId);
                        navigate("/leads");
                      })();
                    }}
                  >
                    Skip & next
                  </button>
                  <button
                    type="button"
                    disabled={pending || starting}
                    title="Re-read the lead queue from the sheet"
                    className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
                    onClick={() => void runQueue(() => refreshLeads(data.selectedCampaignId))}
                  >
                    Reload
                  </button>
                </div>
                {disabledReason ? <p className="mt-2 text-sm text-slate-600">{disabledReason}</p> : null}
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Campaign discovery approach</summary>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
                    {(campaign?.requiredQuestions ?? []).map((question) => (
                      <li key={question.id}>
                        {question.prompt}
                        {question.required ? " (priority)" : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
            </aside>
          </section>

          {campaign?.brief ? (
            <>
              {preparing ? (
                <div className="mt-5">
                  <LoadingSkeleton
                    title={`Researching ${lead.company || "the company"}…`}
                    detail={`Preparing questions for ${lead.fullName || "this prospect"}. This can take a minute or two.`}
                    lines={4}
                  />
                </div>
              ) : null}
              {prepError ? <p role="alert" className="mt-5 text-sm text-red-700">{prepError}</p> : null}
              {preparation ? <ProspectBrief preparation={preparation} /> : null}
              <button
                type="button"
                disabled={preparing || pending}
                title="Run fresh web research and generate a new brief for this lead"
                className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPrepRefresh({ key: prepKey, attempt: refreshAttempt + 1 })}
              >
                {prepError ? "Retry preparation" : "Regenerate brief"}
              </button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
