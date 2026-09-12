import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button } from "@heroui/react";
import { useSession } from "../state/session";
import { fetchBootstrap } from "../state/api";
import { fetchCallSession } from "../state/calls";
import { hangUpTwilioCall } from "../twilio/device";
import { CampaignDrawer } from "../components/CampaignDrawer";
import { CallingPanel } from "../components/CallingPanel";
import { ReadinessChip } from "../components/ReadinessChip";
import { PRODUCT_NAME } from "../copy";
import type { CallSessionView } from "../state/calls";
import { useState } from "react";

export function AppLayout() {
  const {
    data, pending, error, handleSelectCampaign, refresh,
    deviceStatus, deviceDetail, incoming, answerIncoming, declineIncoming,
    campaignBusy, setCampaignBusy, editor, setEditor, liveCall
  } = useSession();
  const [inboundCall, setInboundCall] = useState<CallSessionView | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const twilioConfigured = data.twilio.status === "ok";
  const onReview = location.pathname.includes("/calls/") && location.pathname.endsWith("/review");
  const hideCampaignChrome = Boolean(liveCall) || onReview;

  function guardLeadsNav(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!liveCall) return;
    event.preventDefault();
    if (window.confirm("You are on a live call. Leave this call?")) {
      hangUpTwilioCall();
      navigate("/leads");
    }
  }

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
    <div className="bg-background text-foreground min-h-screen">
      <header className={`border-separator bg-surface/95 sticky top-0 z-40 border-b backdrop-blur ${liveCall ? "hidden" : ""}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
          <Link to="/leads" className="text-foreground text-base font-semibold tracking-tight" onClick={guardLeadsNav}>
            {PRODUCT_NAME}
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
            <NavLink
              to="/leads"
              onClick={guardLeadsNav}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 font-medium ${isActive ? "bg-foreground text-background" : "text-muted hover:bg-surface-secondary"}`
              }
            >
              Ready
            </NavLink>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {data.campaigns.length > 0 ? (
              <label className="text-muted flex items-center gap-2 text-xs font-medium uppercase tracking-wide" htmlFor="campaign">
                Campaign
                <select
                  id="campaign"
                  aria-label="Campaign"
                  className="border-separator bg-surface text-foreground rounded-md border px-2 py-1.5 text-sm normal-case tracking-normal"
                  value={data.selectedCampaignId ?? ""}
                  disabled={pending || campaignBusy || Boolean(editor) || Boolean(liveCall)}
                  onChange={(event) => {
                    void handleSelectCampaign(event.target.value);
                  }}
                >
                  {data.campaigns.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <ReadinessChip
              sheet={data.sheet}
              twilioConfigured={twilioConfigured}
              deviceStatus={deviceStatus}
              diagnosticCount={data.sheet.diagnostics.length}
            />
            {hideCampaignChrome ? null : (
              <Button
                variant={data.campaigns.length > 0 ? "outline" : "primary"}
                size="sm"
                onPress={() => setEditor("new")}
                isDisabled={pending || campaignBusy || Boolean(editor)}
              >
                New campaign
              </Button>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-2">
          <p className="text-muted text-xs">
            {data.twilio.callerId ? `Calling from ${data.twilio.callerId} · ` : ""}{deviceDetail}
          </p>
        </div>
      </header>

      {incoming ? (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <Alert status="success" role="alert" aria-label="Incoming call">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Incoming call from {incoming.from}</Alert.Title>
              <Alert.Description>Answer to talk in your browser, or decline to send them away.</Alert.Description>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button isDisabled={pending} onPress={() => void onAnswer()}>
                  Answer
                </Button>
                <Button variant="outline" onPress={declineIncoming}>
                  Decline
                </Button>
              </div>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error}</Alert.Title>
            </Alert.Content>
          </Alert>
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

      {liveCall ? null : (
        <CampaignDrawer
          mode={editor}
          campaign={data.campaigns.find((item) => item.id === data.selectedCampaignId)}
          sheet={data.sheet}
          onBusy={setCampaignBusy}
          aiMessage={data.ai.status !== "ok" ? data.ai.message : undefined}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await refresh();
            setEditor(null);
          }}
          onSheetBound={refresh}
        />
      )}
    </div>
  );
}

export async function resolveInboundSession(sessionId: string): Promise<CallSessionView> {
  return fetchCallSession(sessionId);
}
