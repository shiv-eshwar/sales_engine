import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../state/session";
import { fetchBootstrap } from "../state/api";
import { fetchCallSession } from "../state/calls";
import { hangUpTwilioCall } from "../twilio/device";
import { CampaignDrawer } from "../components/CampaignDrawer";
import { CallingPanel } from "../components/CallingPanel";
import type { CallSessionView } from "../state/calls";

function StatusDot({ tone, label, value }: { tone: "ok" | "warn" | "bad"; label: string; value: string }) {
  const color = tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600" aria-label={`${label} ${value}`}>
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}: <strong className="font-semibold text-slate-800">{value}</strong>
    </span>
  );
}

export function AppLayout() {
  const {
    data, pending, error, handleSelectCampaign, refresh,
    deviceStatus, deviceDetail, incoming, answerIncoming, declineIncoming,
    campaignBusy, setCampaignBusy, editor, setEditor
  } = useSession();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [inboundCall, setInboundCall] = useState<CallSessionView | null>(null);
  const navigate = useNavigate();
  const twilioConfigured = data.twilio.status === "ok";
  const sheetBlocking = data.sheet.status === "error" || data.sheet.status === "unconfigured";

  async function onAnswer() {
    const session = await answerIncoming();
    if (!session) return;
    if (session.campaignId === "inbound") {
      setInboundCall(session);
      return;
    }
    navigate(`/leads/${session.leadId}`);
  }

  async function closeInboundCall() {
    hangUpTwilioCall();
    setInboundCall(null);
    try {
      const bootstrap = await fetchBootstrap();
      void bootstrap;
      await refresh();
    } catch {
      // refresh() already surfaces errors
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
          <Link to="/leads" className="text-base font-semibold tracking-tight text-slate-900">
            Hammerhead
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
            <NavLink
              to="/leads"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
              }
            >
              Leads
            </NavLink>
            <NavLink
              to="/review"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
              }
            >
              Review
            </NavLink>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="campaign">
              Campaign
              <select
                id="campaign"
                aria-label="Campaign"
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm normal-case tracking-normal text-slate-900"
                value={data.selectedCampaignId ?? ""}
                disabled={pending || campaignBusy || Boolean(editor)}
                onChange={(event) => {
                  void handleSelectCampaign(event.target.value);
                }}
              >
                {!data.campaigns.length ? <option value="">Create your first campaign</option> : null}
                {data.campaigns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <StatusDot
              tone={data.sheet.status === "ok" ? "ok" : "bad"}
              label="Sheet"
              value={data.sheet.status}
            />
            <StatusDot
              tone={!twilioConfigured ? "bad" : deviceStatus === "registered" ? "ok" : deviceStatus === "error" ? "bad" : "warn"}
              label="Twilio device"
              value={twilioConfigured ? deviceStatus : data.twilio.status.replaceAll("_", " ")}
            />
            <button
              type="button"
              onClick={() => setEditor("new")}
              disabled={pending || campaignBusy || Boolean(editor)}
              className="rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              New campaign
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-2">
          <p className="text-xs text-slate-500">
            {data.twilio.callerId ? `Calling from ${data.twilio.callerId} · ` : ""}{deviceDetail}
            {data.sheet.diagnostics.length > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setShowDiagnostics((v) => !v)}
                  aria-expanded={showDiagnostics}
                  aria-label={sheetBlocking ? "Sheet blocking error" : "Queue diagnostics"}
                >
                  {sheetBlocking ? "Sheet needs attention" : "Queue diagnostics"} ({data.sheet.diagnostics.length})
                </button>
              </>
            ) : null}
          </p>
          {showDiagnostics && data.sheet.diagnostics.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
              {data.sheet.diagnostics.map((item, index) => (
                <li key={`${item.code}-${index}`}>{item.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      {incoming ? (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <section className="rounded-lg border border-emerald-500 bg-emerald-50 p-5" role="alert" aria-label="Incoming call">
            <h2 className="text-xl font-semibold">Incoming call from {incoming.from}</h2>
            <p className="mt-1 text-sm text-slate-700">Answer to talk in your browser, or decline to send them away.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => void onAnswer()}
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
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <p role="alert" className="text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {inboundCall ? (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <CallingPanel
            session={inboundCall}
            recordingNotice={data.recordingNotice}
            onSession={setInboundCall}
            onTerminal={() => void closeInboundCall()}
          />
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-6 py-6">
        <Outlet />
      </main>

      <CampaignDrawer
        mode={editor}
        campaign={data.campaigns.find((item) => item.id === data.selectedCampaignId)}
        onBusy={setCampaignBusy}
        aiMessage={data.ai.status !== "ok" ? data.ai.message : undefined}
        onClose={() => setEditor(null)}
        onSaved={async () => {
          await refresh();
          setEditor(null);
        }}
      />
    </div>
  );
}

export async function resolveInboundSession(sessionId: string): Promise<CallSessionView> {
  return fetchCallSession(sessionId);
}
