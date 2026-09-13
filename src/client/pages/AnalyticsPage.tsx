import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CampaignSelect } from "../components/CampaignSelect";
import { DailySummaryPanel } from "../components/DailySummaryPanel";
import { AnalyticsStatsSkeleton } from "../components/LoadingSkeleton";
import { useSession } from "../state/session";
import { fetchSummary } from "../state/api";
import type { DailySummary } from "../../shared/contracts";
import { PAGE_TITLES } from "../copy";
import { usePageTitle } from "../usePageTitle";

const presetClass = "min-h-9 rounded-md px-3 text-sm font-semibold text-muted hover:text-foreground";
const presetActiveClass = "min-h-9 rounded-md bg-surface px-3 text-sm font-semibold text-foreground shadow-sm";

function utcDayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDay(isoDate: string, days: number): string {
  const next = new Date(`${isoDate}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function isDayStamp(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function formatDayHeading(iso: string): string {
  const today = utcDayStamp();
  if (iso === today) return "Today";
  if (iso === shiftUtcDay(today, -1)) return "Yesterday";
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function AnalyticsPage() {
  usePageTitle(PAGE_TITLES.analytics);
  const { data } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = utcDayStamp();
  const date = isDayStamp(searchParams.get("date")) ? searchParams.get("date")! : today;
  const campaignId = searchParams.get("campaignId") ?? "";
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedName = useMemo(
    () => data.campaigns.find((item) => item.id === campaignId)?.name,
    [campaignId, data.campaigns]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSummary({ date, campaignId: campaignId || null })
      .then((result) => {
        if (cancelled) return;
        setSummary(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSummary(null);
        setError(err instanceof Error ? err.message : "Could not load summary");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, date]);

  function setFilter(next: { date?: string; campaignId?: string }) {
    const params = new URLSearchParams(searchParams);
    const nextDate = next.date ?? date;
    const nextCampaign = next.campaignId ?? campaignId;
    if (nextDate === today) params.delete("date");
    else params.set("date", nextDate);
    if (nextCampaign) params.set("campaignId", nextCampaign);
    else params.delete("campaignId");
    setSearchParams(params, { replace: true });
  }

  const dayPhrase =
    date === today ? "today" : date === shiftUtcDay(today, -1) ? "yesterday" : `on ${formatDayHeading(date)}`;
  const emptyCopy = `No calls ${dayPhrase}${selectedName ? ` for ${selectedName}` : ""}. Counts stay at zero until you place a call.`;

  return (
    <div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDayHeading(date)}
            {selectedName ? ` · ${selectedName}` : ""}
          </p>
        </div>

        <form className="flex min-w-0 flex-wrap items-center gap-3" onSubmit={(event) => event.preventDefault()}>
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-secondary p-1">
            <button
              type="button"
              className={date === today ? presetActiveClass : presetClass}
              aria-pressed={date === today}
              onClick={() => setFilter({ date: today })}
            >
              Today
            </button>
            <button
              type="button"
              className={date === shiftUtcDay(today, -1) ? presetActiveClass : presetClass}
              aria-pressed={date === shiftUtcDay(today, -1)}
              onClick={() => setFilter({ date: shiftUtcDay(today, -1) })}
            >
              Yesterday
            </button>
            <input
              type="date"
              aria-label="Summary date"
              className="field-quiet h-9 w-[10.5rem] rounded-md px-2 text-sm text-foreground"
              value={date}
              max={today}
              onChange={(event) => {
                const value = event.target.value;
                if (isDayStamp(value)) setFilter({ date: value });
              }}
            />
          </div>
          <div className="w-full min-w-0 sm:w-72">
            <CampaignSelect
              includeAll
              ariaLabel="Filter campaign"
              campaigns={data.campaigns}
              value={campaignId}
              onChange={(next) => setFilter({ campaignId: next })}
            />
          </div>
        </form>
      </div>

      <div className="mt-8">
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : loading ? (
          <AnalyticsStatsSkeleton />
        ) : summary ? (
          <DailySummaryPanel
            summary={summary}
            emptyCopy={summary.attempts === 0 ? emptyCopy : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
