import { useEffect, useMemo, useState } from "react";
import type { BootstrapResponse } from "../../shared/contracts";
import { CallingPanel } from "../components/CallingPanel";
import { logout, refreshLeads, selectCampaign, skipLead } from "../state/api";
import {
  callDisabledReason,
  cancelCallSession,
  createCallSession,
  type CallSessionView,
  type DeviceStatus
} from "../state/calls";
import { connectTwilioCall, hangUpTwilioCall, startTwilioDevice, stopTwilioDevice } from "../twilio/device";

type ReadyPageProps = {
  data: BootstrapResponse;
  onChange: (next: BootstrapResponse) => void;
  onLoggedOut: () => void;
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

export function ReadyPage({ data, onChange, onLoggedOut }: ReadyPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("offline");
  const [deviceDetail, setDeviceDetail] = useState(data.twilio.message);
  const [call, setCall] = useState<CallSessionView | null>(null);
  const campaign = useMemo(
    () => data.campaigns.find((item) => item.id === data.selectedCampaignId) ?? data.campaigns[0],
    [data.campaigns, data.selectedCampaignId]
  );
  const lead = data.lead;
  const twilioConfigured = data.twilio.status === "ok";
  const callActive = Boolean(call);
  const disabledReason = callDisabledReason({
    twilioConfigured,
    deviceStatus,
    lead,
    callActive
  });

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

  async function run(action: () => Promise<Partial<BootstrapResponse> & { lead?: BootstrapResponse["lead"]; sheet?: BootstrapResponse["sheet"] }>) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      onChange({
        ...data,
        ...result,
        lead: "lead" in result ? (result.lead ?? null) : data.lead,
        sheet: result.sheet ?? data.sheet,
        selectedCampaignId: result.selectedCampaignId ?? data.selectedCampaignId
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function onCall() {
    if (!lead || !data.selectedCampaignId || disabledReason) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const session = await createCallSession(lead.leadId, data.selectedCampaignId);
      setCall(session);
      try {
        await connectTwilioCall(session.id);
      } catch (connectError) {
        await cancelCallSession(session.id);
        setCall(null);
        throw connectError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start call");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{callActive ? "On a call" : "Ready to call"}</h1>
          <p className="text-sm text-slate-600">
            {callActive ? "Stay on this page until the call ends." : "Select a campaign and call the next eligible lead from the browser."}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          disabled={callActive}
          onClick={() => {
            void logout().then(onLoggedOut);
          }}
        >
          Sign out
        </button>
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
            disabled={pending || callActive}
            onChange={(event) => {
              const campaignId = event.target.value;
              void run(() => selectCampaign(campaignId));
            }}
          >
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
          detail={deviceDetail}
        />
      </section>

      {data.sheet.diagnostics.length > 0 && !callActive ? (
        <section className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3" aria-label="Sheet diagnostics">
          <h2 className="text-sm font-semibold">Queue diagnostics</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-950">
            {data.sheet.diagnostics.map((item, index) => (
              <li key={`${item.code}-${index}`}>{item.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {call ? (
        <CallingPanel
          session={call}
          recordingNotice={data.recordingNotice}
          onSession={setCall}
          onEnded={() => {
            hangUpTwilioCall();
            setCall(null);
          }}
        />
      ) : (
        <>
          <section className="mt-6 grid gap-6 lg:grid-cols-5">
            <article className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Next contact</h2>
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
                <p className="mt-3 text-slate-700">No eligible lead is available. Refresh after Gumloop adds Ready or Retry rows.</p>
              )}
            </article>

            <aside className="space-y-4 lg:col-span-2">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Campaign objective</h2>
                <p className="mt-2 text-sm text-slate-800">{campaign?.objective ?? "No campaign loaded"}</p>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Required questions</summary>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
                    {(campaign?.requiredQuestions ?? []).map((question) => (
                      <li key={question.id}>
                        {question.prompt}
                        {question.required ? " (required)" : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
            </aside>
          </section>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={Boolean(disabledReason) || pending}
              title={disabledReason ?? "Start a call"}
              className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:bg-slate-300 disabled:text-slate-600"
              onClick={() => {
                void onCall();
              }}
            >
              Call
            </button>
            <button
              type="button"
              disabled={pending || !lead}
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
              disabled={pending}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
              onClick={() => {
                void run(() => refreshLeads(data.selectedCampaignId));
              }}
            >
              Refresh
            </button>
            {disabledReason ? <p className="text-sm text-slate-600">{disabledReason}</p> : null}
          </div>
        </>
      )}
    </main>
  );
}
