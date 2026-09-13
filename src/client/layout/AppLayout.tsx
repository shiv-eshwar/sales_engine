import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button } from "@heroui/react";
import { useSession } from "../state/session";
import { fetchBootstrap } from "../state/api";
import { fetchCallSession } from "../state/calls";
import { hangUpTwilioCall } from "../twilio/device";
import { CampaignDrawer } from "../components/CampaignDrawer";
import { CampaignSelect } from "../components/CampaignSelect";
import { CallingPanel } from "../components/CallingPanel";
import { ReadinessChip } from "../components/ReadinessChip";
import { PRODUCT_NAME } from "../copy";
import { SHELL, isWorkspacePath } from "./shell";
import type { CallSessionView } from "../state/calls";
import { useLayoutEffect, useState } from "react";

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
  const lockWorkspace = isWorkspacePath(location.pathname) && !liveCall && !inboundCall;

  useLayoutEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    const reset = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const root = document.getElementById("root");
      if (root) root.scrollTop = 0;
      for (const node of document.querySelectorAll<HTMLElement>("main, [class*='overflow-y-auto']")) {
        node.scrollTop = 0;
      }
    };
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

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
    <div className={`flex min-h-dvh flex-col ${lockWorkspace ? "lg:h-dvh lg:overflow-hidden lg:overscroll-none" : ""}`}>
      <header className={`sticky top-0 z-50 bg-background ${liveCall ? "hidden" : ""}`}>
        <div className="h-[3px] bg-accent" />
        <div className={`${SHELL} flex h-14 min-w-0 items-center gap-2 sm:gap-6`}>
          <Link
            to="/leads"
            className="shrink-0 text-[15px] font-semibold tracking-tight text-foreground"
            onClick={guardLeadsNav}
          >
            {PRODUCT_NAME}
          </Link>
          {hasCampaigns ? (
            <CampaignSelect
              id="campaign"
              appearance="header"
              ariaLabel="Campaign"
              campaigns={data.campaigns}
              className="min-w-0 flex-1"
              isDisabled={pending || campaignBusy || Boolean(editor) || Boolean(liveCall)}
              title={selectedCampaign?.name}
              value={data.selectedCampaignId ?? ""}
              onChange={(campaignId) => {
                void handleSelectCampaign(campaignId);
              }}
            />
          ) : null}

          <div className="ml-auto flex min-w-0 max-w-[62%] shrink-0 items-center justify-end gap-2 sm:max-w-none sm:gap-4">
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
            <Link
              to="/notifications"
              aria-label={
                data.pendingProposal
                  ? "Notifications, 1 waiting"
                  : "Notifications"
              }
              className={`shrink-0 text-sm font-semibold ${
                location.pathname.startsWith("/notifications")
                  ? "text-foreground"
                  : "text-muted hover:text-foreground hover:underline hover:underline-offset-4"
              }`}
            >
              Notifications
              {data.pendingProposal ? (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-lg bg-accent-soft px-1 text-xs font-semibold text-accent">
                  1
                </span>
              ) : null}
            </Link>
            <Link
              to="/analytics"
              className={`shrink-0 text-sm font-semibold ${
                location.pathname.startsWith("/analytics")
                  ? "text-foreground"
                  : "text-muted hover:text-foreground hover:underline hover:underline-offset-4"
              }`}
            >
              Analytics
            </Link>
            {hideCampaignChrome ? null : (
              <button
                type="button"
                aria-label="New campaign"
                className="shrink-0 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
                disabled={pending || campaignBusy || Boolean(editor)}
                onClick={() => setEditor("new")}
              >
                <span className="sm:hidden" aria-hidden="true">New</span>
                <span className="hidden sm:inline">New campaign</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {incoming ? (
        <div className={`${SHELL} pt-5`}>
          <Alert status="success" role="alert" aria-label="Incoming call">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Incoming call from {incoming.from}</Alert.Title>
              <Alert.Description>Answer to talk in your browser, or decline to send them away.</Alert.Description>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button className="min-h-11 rounded-lg!" isDisabled={pending} onPress={() => void onAnswer()}>
                  Answer
                </Button>
                <Button variant="outline" className="min-h-11 rounded-lg!" onPress={declineIncoming}>
                  Decline
                </Button>
              </div>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div className={`${SHELL} pt-5`}>
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

      <main
        className={`${SHELL} flex min-h-0 flex-1 flex-col py-4 sm:py-5 ${
          lockWorkspace
            ? "pb-[max(1rem,env(safe-area-inset-bottom))] lg:overflow-hidden lg:pb-5"
            : "pb-8"
        }`}
      >
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
