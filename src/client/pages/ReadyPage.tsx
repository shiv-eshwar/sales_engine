import { useEffect, useMemo, useState } from "react";
import type { BootstrapResponse } from "../../shared/contracts";
import { CallingPanel } from "../components/CallingPanel";
import { DailySummaryPanel } from "../components/DailySummaryPanel";
import { ReviewPanel } from "../components/ReviewPanel";
import { CampaignDrawer } from "../components/CampaignDrawer";
import { ProspectBrief } from "../components/ProspectBrief";
import type { ProspectPreparation } from "../../shared/campaigns";
import {
  approveProposal,
  discardProposal,
  fetchBootstrap,
  finalizeCall,
  refreshLeads,
  retryProposalProcessing,
  retryProposalWrite,
  selectLead,
  skipLead,
  skipProposal,
  selectCampaign,
  prepareLead
} from "../state/api";
import {
  callDisabledReason,
  cancelCallSession,
  createCallSession,
  fetchCallSession,
  type CallSessionView,
  type DeviceStatus
} from "../state/calls";
import { acceptTwilioIncomingCall, connectTwilioCall, hangUpTwilioCall, onTwilioIncoming, rejectTwilioIncomingCall, setPendingIncomingCall, startTwilioDevice, stopTwilioDevice } from "../twilio/device";
import type { Call } from "@twilio/voice-sdk";
import type { PublicProposal, PublicWriteFields } from "../../shared/contracts";

type ReadyPageProps = {
  data: BootstrapResponse;
  onChange: (next: BootstrapResponse) => void;
};

function StatusText({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold" aria-label={`${label} ${value}`}>
        {value}
      </p>
      <p className="text-xs text-slate-600">{detail}</p>
    </div>
  );
}

export function ReadyPage({ data, onChange }: ReadyPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("offline");
  const [deviceDetail, setDeviceDetail] = useState(data.twilio.message);
  const [call, setCall] = useState<CallSessionView | null>(null);
  const [incoming, setIncoming] = useState<{ call: Call; sessionId: string; from: string } | null>(null);
  const [review, setReview] = useState<PublicProposal | null>(data.pendingProposal);
  const [editor, setEditor] = useState<"new" | "edit" | null>(data.campaigns.length ? null : "new");
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [prepState, setPrepState] = useState<{ key: string; result: ProspectPreparation | null; error: string | null; loading: boolean } | null>(null);
  const [prepRefresh, setPrepRefresh] = useState<{ key: string; attempt: number } | null>(null);
  const campaign = useMemo(
    () => data.campaigns.find((item) => item.id === data.selectedCampaignId) ?? data.campaigns[0],
    [data.campaigns, data.selectedCampaignId]
  );
  const lead = data.lead;
  const leads = data.leads ?? (lead ? [lead] : []);
  const twilioConfigured = data.twilio.status === "ok";
  const callActive = Boolean(call);
  const reviewing = Boolean(review) && !callActive;
  const prepKey = campaign?.brief && lead ? JSON.stringify([campaign.id, campaign.version, lead.leadId, lead.company, lead.fullName, lead.role, lead.enrichment]) : "";
  const preparation = prepState?.key === prepKey ? prepState.result : null;
  const prepError = prepState?.key === prepKey ? prepState.error : null;
  const preparing = Boolean(prepKey && (prepState?.key !== prepKey || prepState.loading));
  const refreshAttempt = prepRefresh?.key === prepKey ? prepRefresh.attempt : 0;
  const disabledReason = !campaign ? "Create a campaign first" : campaign.brief && (!preparation || preparing)
    ? preparing ? "Preparing research and call brief…" : "Generate a call brief before calling"
    : callDisabledReason({
    twilioConfigured,
    deviceStatus,
    lead,
    callActive,
    sheetStatus: data.sheet.status
  });
  const sheetBlocking = data.sheet.status === "error" || data.sheet.status === "unconfigured";

  useEffect(() => {
    if (!prepKey || !campaign || !lead || callActive || reviewing) return;
    const controller = new AbortController();
    setPrepState({ key: prepKey, result: null, error: null, loading: true });
    void prepareLead(campaign.id, lead.leadId, refreshAttempt > 0, controller.signal).then(result => {
      if (!controller.signal.aborted) setPrepState({ key: prepKey, result, error: null, loading: false });
    }).catch(err => {
      if (!controller.signal.aborted) setPrepState({ key: prepKey, result: null, error: err instanceof Error ? err.message : "Preparation failed", loading: false });
    });
    return () => controller.abort();
  }, [prepKey, refreshAttempt, callActive, reviewing]);

  useEffect(() => {
    if (!twilioConfigured) {
      setDeviceStatus("offline");
      setDeviceDetail(data.twilio.message);
      return undefined;
    }
    let cancelled = false;
    void startTwilioDevice((status, detail) => {
      if (!cancelled) {
        setDeviceStatus(status);
        setDeviceDetail(detail);
      }
    }).catch((err: unknown) => {
      if (!cancelled) {
        setDeviceStatus("error");
        setDeviceDetail(err instanceof Error ? err.message : "Twilio device failed");
      }
    });
    return () => {
      cancelled = true;
      void stopTwilioDevice();
    };
  }, [twilioConfigured, data.twilio.message]);

  useEffect(() => {
    if (deviceStatus !== "registered" || callActive) {
      return undefined;
    }
    return onTwilioIncoming((call) => {
      const sessionId = call.customParameters.get("sessionId") ?? "";
      const from = call.customParameters.get("From") ?? call.parameters["From"] ?? "Unknown caller";
      if (!sessionId) {
        call.reject();
        return;
      }
      setPendingIncomingCall(call);
      const clear = () => {
        setIncoming((current) => (current?.call === call ? null : current));
      };
      call.on("cancel", clear);
      call.on("disconnect", clear);
      setIncoming({ call, sessionId, from });
    });
  }, [deviceStatus, callActive]);

  async function run(action: () => Promise<Partial<BootstrapResponse> & { lead?: BootstrapResponse["lead"]; leads?: BootstrapResponse["leads"]; sheet?: BootstrapResponse["sheet"] }>) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      onChange({
        ...data,
        ...result,
        lead: "lead" in result ? (result.lead ?? null) : data.lead,
        leads: "leads" in result && result.leads ? result.leads : (data.leads ?? (data.lead ? [data.lead] : [])),
        sheet: result.sheet ?? data.sheet,
        selectedCampaignId: result.selectedCampaignId ?? data.selectedCampaignId
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function answerIncoming() {
    if (!incoming) {
      return;
    }
    const { call: ringing, sessionId } = incoming;
    setIncoming(null);
    setPending(true);
    setError(null);
    try {
      acceptTwilioIncomingCall(ringing);
      setCall(await fetchCallSession(sessionId));
    } catch (err) {
      hangUpTwilioCall();
      setError(err instanceof Error ? err.message : "Could not answer call");
    } finally {
      setPending(false);
    }
  }

  function declineIncoming() {
    if (!incoming) {
      return;
    }
    rejectTwilioIncomingCall(incoming.call);
    setIncoming(null);
  }

  async function onCall() {
    if (!lead || !data.selectedCampaignId || disabledReason) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const session = await createCallSession(lead.leadId, data.selectedCampaignId, preparation?.id);
      setCall(session);
      try {
        await connectTwilioCall(session.id);
      } catch (connectError) {
        await cancelCallSession(session.id);
        try {
          setReview(await finalizeCall(session.id));
        } catch {
          setCall(null);
        }
        setCall(null);
        throw connectError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start call");
    } finally {
      setPending(false);
    }
  }

  async function openReview(sessionId: string) {
    hangUpTwilioCall();
    const proposal = await finalizeCall(sessionId);
    setReview(proposal);
    setCall(null);
  }

  async function closeInboundCall() {
    hangUpTwilioCall();
    setCall(null);
    try {
      onChange(await fetchBootstrap());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh after call");
    }
  }

  async function afterWrite(result: {
    proposal: PublicProposal;
    lead: BootstrapResponse["lead"];
    leads?: BootstrapResponse["leads"];
    sheet: BootstrapResponse["sheet"];
  }) {
    if (result.proposal.status === "applied" || result.proposal.status === "discarded") {
      setReview(null);
      const bootstrap = await fetchBootstrap();
      onChange(bootstrap);
      return;
    }
    setReview(result.proposal);
    onChange({
      ...data,
      lead: result.lead,
      leads: result.leads ?? data.leads,
      sheet: result.sheet,
      pendingProposal: result.proposal.status === "pending_retry" ? result.proposal : null
    });
  }

  async function onReviewApprove(fields?: PublicWriteFields) {
    if (!review) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await afterWrite(await approveProposal(review.id, fields));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {callActive ? "On a call" : reviewing ? "Review" : "Ready to call"}
          </h1>
          <p className="text-sm text-slate-600">
            {callActive
              ? "Stay on this page until the call ends."
              : reviewing
                ? "Review the proposed Sheet update before anything is written."
                : "Choose an offering, review your prospect brief, and call the next lead."}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="System status">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="campaign">
            Campaign
          </label>
          <select
            id="campaign"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
            value={data.selectedCampaignId ?? ""}
            disabled={pending || campaignBusy || callActive || reviewing || Boolean(editor)}
            onChange={(event) => {
              const campaignId = event.target.value;
              void run(() => selectCampaign(campaignId));
            }}
          >
            {!data.campaigns.length ? <option value="">Create your first campaign</option> : null}
            {data.campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <StatusText label="Sheet" value={data.sheet.status} detail={data.sheet.message} />
        <StatusText
          label="Twilio device"
          value={twilioConfigured ? deviceStatus : data.twilio.status.replaceAll("_", " ")}
          detail={data.twilio.callerId ? `Calling from ${data.twilio.callerId} · ${deviceDetail}` : deviceDetail}
        />
      </section>

      {!callActive && !reviewing ? <>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending || campaignBusy || Boolean(editor)} className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => { setEditor("new"); }}>New campaign</button>
          {campaign?.brief ? <button type="button" disabled={pending || campaignBusy || Boolean(editor)} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" onClick={() => { setEditor("edit"); }}>Edit offering</button> : null}
          {campaign?.brief && !editor ? <p className="text-sm text-slate-600">Selling <strong>{campaign.brief.offeringName}</strong> · Strategy v{campaign.version}</p> : null}
        </div>
        {data.ai.status !== "ok" ? <p role="status" className="mt-3 text-sm text-amber-800">{data.ai.message}</p> : null}
        {data.research.status !== "ok" && data.ai.status === "ok" ? <p className="mt-3 text-sm text-amber-800">{data.research.message}</p> : null}
        <CampaignDrawer
          mode={editor}
          campaign={campaign}
          onBusy={setCampaignBusy}
          aiMessage={data.ai.status !== "ok" ? data.ai.message : undefined}
          onClose={() => setEditor(null)}
          onSaved={async () => { onChange(await fetchBootstrap()); setEditor(null); }}
        />
      </> : null}

      {data.sheet.diagnostics.length > 0 && !callActive && !reviewing ? (
        <section
          className={`mt-4 rounded-md border p-3 ${
            sheetBlocking ? "border-red-400 bg-red-50" : "border-amber-300 bg-amber-50"
          }`}
          aria-label={sheetBlocking ? "Sheet blocking error" : "Sheet diagnostics"}
          role={sheetBlocking ? "alert" : undefined}
        >
          <h2 className="text-sm font-semibold">{sheetBlocking ? "Sheet is not ready" : "Queue diagnostics"}</h2>
          <p className="mt-1 text-sm">{data.sheet.message}</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-950">
            {data.sheet.diagnostics.map((item, index) => (
              <li key={`${item.code}-${index}`}>{item.message}</li>
            ))}
          </ul>
        </section>
      ) : sheetBlocking && !callActive && !reviewing ? (
        <section className="mt-4 rounded-md border border-red-400 bg-red-50 p-3" role="alert" aria-label="Sheet blocking error">
          <h2 className="text-sm font-semibold">Sheet is not ready</h2>
          <p className="mt-1 text-sm">{data.sheet.message}</p>
          <p className="mt-1 text-sm">Call is disabled until the Sheet schema is fixed.</p>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {incoming && !callActive ? (
        <section className="mt-4 rounded-lg border border-emerald-500 bg-emerald-50 p-5" role="alert" aria-label="Incoming call">
          <h2 className="text-xl font-semibold">Incoming call from {incoming.from}</h2>
          <p className="mt-1 text-sm text-slate-700">Answer to talk in your browser, or decline to send them away.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                void answerIncoming();
              }}
              className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              Answer
            </button>
            <button
              type="button"
              onClick={declineIncoming}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium"
            >
              Decline
            </button>
          </div>
        </section>
      ) : null}

      {call ? (
        <CallingPanel
          session={call}
          recordingNotice={data.recordingNotice}
          onSession={setCall}
          onTerminal={() => {
            if (call.campaignId === "inbound") {
              // Inbound calls have no campaign to review against; just close out.
              void closeInboundCall();
              return;
            }
            void openReview(call.id).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Could not prepare review");
              setCall(null);
            });
          }}
        />
      ) : review ? (
        <ReviewPanel
          proposal={review}
          pending={pending}
          error={error}
          onApprove={(fields) => {
            void onReviewApprove(fields);
          }}
          onRetryWrite={() => {
            void (async () => {
              setPending(true);
              setError(null);
              try {
                await afterWrite(await retryProposalWrite(review.id));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Retry failed");
              } finally {
                setPending(false);
              }
            })();
          }}
          onRetryProcessing={() => {
            void (async () => {
              setPending(true);
              setError(null);
              try {
                setReview(await retryProposalProcessing(review.id));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Reprocessing failed");
              } finally {
                setPending(false);
              }
            })();
          }}
          onSkip={() => {
            void (async () => {
              setPending(true);
              setError(null);
              try {
                await afterWrite(await skipProposal(review.id));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Skip failed");
              } finally {
                setPending(false);
              }
            })();
          }}
          onDiscard={() => {
            void (async () => {
              setPending(true);
              setError(null);
              try {
                await discardProposal(review.id);
                setReview(null);
                onChange(await fetchBootstrap());
              } catch (err) {
                setError(err instanceof Error ? err.message : "Discard failed");
              } finally {
                setPending(false);
              }
            })();
          }}
        />
      ) : (
        <>
          <section className="mt-6 grid gap-6 lg:grid-cols-5">
            <article className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Next contact</h2>
                {leads.length > 0 ? (
                  <p className="text-xs text-slate-500" aria-live="polite">
                    Lead {lead ? leads.findIndex((item) => item.leadId === lead.leadId) + 1 : 0} of {leads.length}
                  </p>
                ) : null}
              </div>
              {leads.length > 1 ? (
                <div className="mt-3">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="lead-queue">
                    Lead queue
                  </label>
                  <select
                    id="lead-queue"
                    aria-label="Lead queue"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                    value={lead?.leadId ?? ""}
                    disabled={pending || campaignBusy || callActive || reviewing}
                    onChange={(event) => {
                      const leadId = event.target.value;
                      if (!leadId || leadId === lead?.leadId) {
                        return;
                      }
                      void run(() => selectLead(leadId, data.selectedCampaignId));
                    }}
                  >
                    {leads.map((item, index) => (
                      <option key={item.leadId} value={item.leadId}>
                        {index + 1}. {item.fullName || "Unnamed contact"} — {item.company || "No company"}{item.dialable ? "" : " (not dialable)"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {lead ? (
                <>
                  <p className="mt-2 text-2xl font-semibold">{lead.fullName || "Unnamed contact"}</p>
                  <p className="text-sm text-slate-700">
                    {lead.role}
                    {lead.role && lead.company ? " · " : ""}
                    {lead.company}
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
                    <h3 className="text-sm font-medium">Enrichment</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{lead.enrichment || "None"}</p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-slate-700">{campaign ? "No eligible lead matches this campaign. Set the campaign's Sheet campaign tag to match the Sheet." : "Create a campaign to start preparing calls."}</p>
              )}
            </article>

            <aside className="space-y-4 lg:col-span-2">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Campaign objective</h2>
                <p className="mt-2 text-sm text-slate-800">{campaign?.objective ?? "No campaign loaded"}</p>
                {campaign?.brief ? <p className="mt-3 text-sm text-slate-600"><strong>Target customer:</strong> {campaign.brief.targetCustomer}</p> : null}
                {campaign?.strategy ? <p className="mt-3 text-sm text-slate-600">{campaign.strategy.positioning}</p> : null}
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

          {campaign?.brief && lead ? <>
            {preparing ? <section role="status" className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-900">Researching {lead.company || "the company"} and preparing questions for {lead.fullName || "this prospect"}… This can take a minute or two.</section> : null}
            {prepError ? <p role="alert" className="mt-5 text-sm text-red-700">{prepError}</p> : null}
            {preparation ? <ProspectBrief preparation={preparation} /> : null}
            <button type="button" disabled={preparing || pending || campaignBusy} title="Run fresh web research and generate a new brief for this lead" className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" onClick={() => setPrepRefresh({ key: prepKey, attempt: refreshAttempt + 1 })}>{prepError ? "Retry preparation" : "Regenerate brief"}</button>
          </> : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {sheetBlocking ? null : (
              <button
                type="button"
                disabled={Boolean(disabledReason) || pending || campaignBusy}
                title={disabledReason ?? "Start a call"}
                className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:bg-slate-300 disabled:text-slate-600"
                onClick={() => {
                  void onCall();
                }}
              >
                Call
              </button>
            )}
            <button
              type="button"
              disabled={pending || campaignBusy || !lead}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
              onClick={() => {
                if (!lead) {
                  return;
                }
                void run(() => skipLead(lead.leadId, data.selectedCampaignId));
              }}
            >
              Skip
            </button>
            <button
              type="button"
              disabled={pending || campaignBusy}
              title="Re-read the lead queue from the sheet"
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
              onClick={() => {
                void run(() => refreshLeads(data.selectedCampaignId));
              }}
            >
              Reload from sheet
            </button>
            {disabledReason ? <p className="text-sm text-slate-600">{disabledReason}</p> : null}
          </div>
          {leads.length > 1 ? (
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5" aria-label="Lead queue list">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
                Lead queue · {leads.length} eligible
              </h2>
              <ol className="mt-3 divide-y divide-slate-100">
                {leads.map((item) => {
                  const active = item.leadId === lead?.leadId;
                  return (
                    <li key={item.leadId} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {item.fullName || "Unnamed contact"}
                          {active ? <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Selected</span> : null}
                        </p>
                        <p className="truncate text-xs text-slate-600">
                          {[item.role, item.company].filter(Boolean).join(" · ") || "No role or company"} · <span className="font-mono">{item.phoneE164 ?? item.phone}</span>
                          {item.dialable ? "" : " · not dialable"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={active || pending || campaignBusy}
                        aria-label={`Select ${item.fullName || item.leadId}`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={() => {
                          void run(() => selectLead(item.leadId, data.selectedCampaignId));
                        }}
                      >
                        {active ? "Selected" : "Select"}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
          <DailySummaryPanel summary={data.summary} />
        </>
      )}
    </main>
  );
}
