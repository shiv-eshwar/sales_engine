import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@heroui/react";
import type { CalendarConnectionStatus, ProviderStatus, SheetInfo } from "../../shared/contracts";
import { NAV_COPY, EMPTY_COPY, PAGE_TITLES, SETTINGS_COPY } from "../copy";
import { SCROLL } from "../layout/shell";
import { disconnectCalendar, fetchHealthReady, logout } from "../state/api";
import type { DeviceStatus } from "../state/calls";
import { useSession } from "../state/session";
import { usePageTitle } from "../usePageTitle";
import { ThemePair } from "../components/ThemeToggle";

export function SettingsPage() {
  usePageTitle(PAGE_TITLES.settings);
  const { data, deviceStatus, deviceDetail, refresh, setEditor } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [flash, setFlash] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deepgram, setDeepgram] = useState<string | null>(null);

  useEffect(() => {
    const flag = searchParams.get("calendar");
    if (flag !== "connected" && flag !== "denied") return;
    setFlash(flag === "connected" ? SETTINGS_COPY.calendar.connectedFlash : SETTINGS_COPY.calendar.deniedFlash);
    void refresh();
    const next = new URLSearchParams(searchParams);
    next.delete("calendar");
    setSearchParams(next, { replace: true });
  }, [refresh, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    void fetchHealthReady()
      .then((ready) => {
        if (!cancelled) setDeepgram(ready.checks.deepgram?.message ?? null);
      })
      .catch(() => {
        if (!cancelled) setDeepgram(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCampaign = data.campaigns.find((item) => item.id === data.selectedCampaignId) ?? null;

  async function onDisconnect() {
    if (!window.confirm(SETTINGS_COPY.calendar.disconnectConfirm)) return;
    setDisconnecting(true);
    try {
      await disconnectCalendar();
      await refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logout();
      window.location.assign("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SettingsView
      calendar={data.calendar ?? { configured: false, connected: false, email: null }}
      sheet={data.sheet}
      campaignName={selectedCampaign?.name ?? null}
      hasCampaigns={data.campaigns.length > 0}
      canEditOffering={Boolean(selectedCampaign?.brief)}
      twilio={data.twilio}
      deviceStatus={deviceStatus}
      deviceDetail={deviceDetail}
      ai={data.ai}
      research={data.research}
      deepgram={deepgram}
      flash={flash}
      disconnecting={disconnecting}
      signingOut={signingOut}
      operatorEmail={data.operator?.email ?? ""}
      onDisconnect={() => void onDisconnect()}
      onSignOut={() => void onSignOut()}
      onNewCampaign={() => setEditor("new")}
      onEditOffering={() => setEditor("edit")}
    />
  );
}

export function SettingsView({
  calendar,
  sheet,
  campaignName,
  hasCampaigns,
  canEditOffering,
  twilio,
  deviceStatus,
  deviceDetail,
  ai,
  research,
  deepgram,
  flash,
  disconnecting,
  signingOut,
  operatorEmail,
  onDisconnect,
  onSignOut,
  onNewCampaign,
  onEditOffering
}: {
  calendar: CalendarConnectionStatus;
  sheet: SheetInfo;
  campaignName: string | null;
  hasCampaigns: boolean;
  canEditOffering: boolean;
  twilio: ProviderStatus;
  deviceStatus: DeviceStatus;
  deviceDetail: string;
  ai: ProviderStatus;
  research: ProviderStatus;
  deepgram: string | null;
  flash: string | null;
  disconnecting?: boolean;
  signingOut?: boolean;
  operatorEmail: string;
  onDisconnect?: () => void;
  onSignOut?: () => void;
  onNewCampaign?: () => void;
  onEditOffering?: () => void;
}) {
  const sheetBlocking = sheet.status === "error" || sheet.status === "unconfigured";
  const sheetConnected = sheet.status === "ok" && (Boolean(sheet.spreadsheetId) || sheet.backend === "memory");
  const twilioOk = twilio.status === "ok";

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${SCROLL}`}>
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-lg font-semibold tracking-tight">{NAV_COPY.settings}</h1>
        {flash ? <p className="mt-2 text-sm text-muted">{flash}</p> : null}

        <div className="mt-10 flex flex-col gap-12">
          <section aria-labelledby="settings-account">
            <h2 id="settings-account" className="text-sm font-medium text-muted">
              {SETTINGS_COPY.account.heading}
            </h2>
            <div className="mt-3">
              <p className="text-base font-semibold tracking-tight">{operatorEmail}</p>
              <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">{SETTINGS_COPY.account.hint}</p>
              <Button
                variant="outline"
                className="mt-4 min-h-11 rounded-lg!"
                isDisabled={signingOut}
                onPress={onSignOut}
              >
                {SETTINGS_COPY.account.signOut}
              </Button>
            </div>
          </section>

          <section aria-labelledby="settings-appearance">
            <h2 id="settings-appearance" className="text-sm font-medium text-muted">
              {SETTINGS_COPY.appearance.heading}
            </h2>
            <p className="mt-3 max-w-[36em] text-sm leading-relaxed text-muted">{SETTINGS_COPY.appearance.hint}</p>
            <ThemePair />
          </section>

          <section aria-labelledby="settings-calendar">
            <h2 id="settings-calendar" className="text-sm font-medium text-muted">
              {SETTINGS_COPY.calendar.heading}
            </h2>
            {calendar.connected ? (
              <div className="mt-3">
                <p className="text-base font-semibold tracking-tight">{calendar.email || SETTINGS_COPY.calendar.connected}</p>
                <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">{SETTINGS_COPY.calendar.connectedHint}</p>
                <Button
                  variant="outline"
                  className="mt-4 min-h-11 rounded-lg!"
                  isDisabled={disconnecting}
                  onPress={onDisconnect}
                >
                  {SETTINGS_COPY.calendar.disconnect}
                </Button>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border-t-[3px] border-t-accent bg-surface p-5 shadow-sm">
                <p className="text-base font-semibold tracking-tight">
                  {calendar.configured ? SETTINGS_COPY.calendar.disconnectedTitle : SETTINGS_COPY.calendar.unconfiguredTitle}
                </p>
                <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">
                  {calendar.configured ? SETTINGS_COPY.calendar.disconnectedHint : SETTINGS_COPY.calendar.unconfiguredHint}
                </p>
                {calendar.configured ? (
                  <Button
                    className="mt-4 min-h-11 rounded-lg!"
                    onPress={() => {
                      window.location.href = "/api/google/calendar/connect";
                    }}
                  >
                    {SETTINGS_COPY.calendar.connect}
                  </Button>
                ) : null}
              </div>
            )}
          </section>

          <section aria-labelledby="settings-sheet">
            <h2 id="settings-sheet" className="text-sm font-medium text-muted">
              {SETTINGS_COPY.sheet.heading}
            </h2>
            {sheetConnected ? (
              <div className="mt-3">
                <p className="text-base font-semibold tracking-tight">{campaignName || sheet.sheetName || SETTINGS_COPY.sheet.heading}</p>
                <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">
                  {sheet.backend === "memory" ? SETTINGS_COPY.sheet.sample : sheet.message}
                </p>
                {sheet.url ? (
                  <a
                    className="mt-4 inline-block text-sm font-semibold text-foreground hover:underline hover:underline-offset-4"
                    href={sheet.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {SETTINGS_COPY.sheet.openSheet}
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border-t-[3px] border-t-accent bg-surface p-5 shadow-sm">
                <p className="text-base font-semibold tracking-tight">
                  {sheet.status === "error" ? EMPTY_COPY.sheet.title : SETTINGS_COPY.sheet.emptyTitle}
                </p>
                <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">
                  {sheet.status === "error"
                    ? sheet.message
                    : hasCampaigns
                      ? SETTINGS_COPY.sheet.emptyWithCampaign
                      : SETTINGS_COPY.sheet.emptyNoCampaign}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {hasCampaigns ? (
                    canEditOffering ? (
                      <Button className="min-h-11 rounded-lg!" onPress={onEditOffering}>
                        {SETTINGS_COPY.sheet.editOffering}
                      </Button>
                    ) : (
                      <Button className="min-h-11 rounded-lg!" onPress={onNewCampaign}>
                        {SETTINGS_COPY.sheet.createCampaign}
                      </Button>
                    )
                  ) : (
                    <Button className="min-h-11 rounded-lg!" onPress={onNewCampaign}>
                      {SETTINGS_COPY.sheet.createCampaign}
                    </Button>
                  )}
                  {sheetBlocking ? (
                    <Link
                      className="text-sm font-semibold text-foreground hover:underline hover:underline-offset-4"
                      to="/notifications#queue"
                    >
                      {SETTINGS_COPY.sheet.queueIssues}
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="settings-twilio">
            <h2 id="settings-twilio" className="text-sm font-medium text-muted">
              {SETTINGS_COPY.twilio.heading}
            </h2>
            {twilioOk ? (
              <div className="mt-3">
                <p className="text-base font-semibold tracking-tight">{twilio.callerId || SETTINGS_COPY.twilio.registered}</p>
                <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">
                  {deviceStatus === "registered"
                    ? SETTINGS_COPY.twilio.registered
                    : deviceStatus === "registering"
                      ? SETTINGS_COPY.twilio.registering
                      : deviceStatus === "error"
                        ? deviceDetail || SETTINGS_COPY.twilio.error
                        : SETTINGS_COPY.twilio.offline}
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border-t-[3px] border-t-accent bg-surface p-5 shadow-sm">
                <p className="text-base font-semibold tracking-tight">{SETTINGS_COPY.twilio.emptyTitle}</p>
                <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">{SETTINGS_COPY.twilio.emptyHint}</p>
              </div>
            )}
          </section>

          <section aria-labelledby="settings-providers">
            <h2 id="settings-providers" className="text-sm font-medium text-muted">
              {SETTINGS_COPY.providers.heading}
            </h2>
            <div className="mt-4 flex flex-col gap-5">
              <ProviderRow label={SETTINGS_COPY.providers.ai} status={ai} />
              {deepgram ? (
                <div>
                  <p className="text-sm font-semibold tracking-tight">{SETTINGS_COPY.providers.deepgram}</p>
                  <p className="mt-0.5 max-w-[36em] text-sm leading-relaxed text-muted">{deepgram}</p>
                </div>
              ) : null}
              <ProviderRow label={SETTINGS_COPY.providers.research} status={research} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({ label, status }: { label: string; status: ProviderStatus }) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-tight">{label}</p>
      <p className="mt-0.5 max-w-[36em] text-sm leading-relaxed text-muted">{status.message}</p>
    </div>
  );
}
