import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const hasCampaigns = data.campaigns.length > 0;
  const selectedCampaign = data.campaigns.find((item) => item.id === data.selectedCampaignId);

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
    <div className="min-h-screen">
      <header className={`sticky top-0 z-50 bg-background ${liveCall ? "hidden" : ""}`}>
        <div className="h-[3px] bg-accent" />
        <div className="mx-auto flex h-14 w-full max-w-6xl min-w-0 items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Link
            to="/leads"
            className="shrink-0 text-[15px] font-semibold tracking-tight text-foreground"
            onClick={guardLeadsNav}
          >
            {PRODUCT_NAME}
          </Link>
          {hasCampaigns ? (
            <select
              id="campaign"
              aria-label="Campaign"
              title={selectedCampaign?.name}
              className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-[15px] font-medium text-foreground"
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
          ) : null}

          <div className="ml-auto flex min-w-0 max-w-[58%] shrink-0 items-center justify-end gap-3 sm:max-w-none sm:gap-4">
            <ReadinessChip
              sheet={data.sheet}
              twilioConfigured={twilioConfigured}
              deviceStatus={deviceStatus}
              diagnosticCount={data.sheet.diagnostics.length}
            />
            {data.twilio.callerId ? (
              <p className="hidden truncate font-mono text-xs text-muted sm:block" title={deviceDetail}>
                {data.twilio.callerId}
              </p>
            ) : null}
            {hideCampaignChrome ? null : (
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
                disabled={pending || campaignBusy || Boolean(editor)}
                onClick={() => setEditor("new")}
              >
                New campaign
              </button>
            )}
          </div>
        </div>
      </header>

      {incoming ? (
        <div className="mx-auto max-w-6xl px-6 pt-5">
          <Alert status="success" role="alert" aria-label="Incoming call">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Incoming call from {incoming.from}</Alert.Title>
              <Alert.Description>Answer to talk in your browser, or decline to send them away.</Alert.Description>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button className="rounded-lg!" isDisabled={pending} onPress={() => void onAnswer()}>
                  Answer
                </Button>
                <Button variant="outline" className="rounded-lg!" onPress={declineIncoming}>
                  Decline
                </Button>
              </div>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto max-w-6xl px-6 pt-5">
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error}</Alert.Title>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {inboundCall ? (
        <CallingPanel
          session={inboundCall}
          recordingNotice={data.recordingNotice}
          onSession={setInboundCall}
          onTerminal={() => void closeInboundCall()}
        />
      ) : null}

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>

      {liveCall ? null : (
        <CampaignDrawer
          mode={editor}
          campaign={selectedCampaign}
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
