import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CampaignSelect } from "../components/CampaignSelect";
import { DailySummaryPanel } from "../components/DailySummaryPanel";
import { useSession } from "../state/session";
import { fetchSummary } from "../state/api";
import type { DailySummary } from "../../shared/contracts";

const fieldClass = "flex min-w-0 flex-col gap-2";
const inputClass =
  "h-11 rounded-lg border border-border bg-surface px-3 text-sm text-foreground";
const presetClass =
  "min-h-9 rounded-md px-3 text-sm font-semibold text-muted hover:text-foreground";
const presetActiveClass =
  "min-h-9 rounded-md bg-surface px-3 text-sm font-semibold text-foreground shadow-sm";

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
      <Breadcrumbs items={[{ label: "Home", to: "/leads" }, { label: "Analytics" }]} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:mt-8">Analytics</h1>
      <p className="mt-3 max-w-[32em] text-sm leading-relaxed text-muted">
        Daily counts from the call ledger for one day.
      </p>

      <form
        className="mt-8 flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-start"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={fieldClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Date</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Summary date"
              className={`${inputClass} w-[11.5rem]`}
              value={date}
              max={today}
              onChange={(event) => {
                const value = event.target.value;
                if (isDayStamp(value)) setFilter({ date: value });
              }}
            />
            <div className="flex rounded-lg bg-surface-secondary p-1">
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
            </div>
          </div>
        </div>
        <div className={`${fieldClass} sm:w-80`}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Campaign</p>
          <CampaignSelect
            includeAll
            ariaLabel="Filter campaign"
            campaigns={data.campaigns}
            value={campaignId}
            onChange={(next) => setFilter({ campaignId: next })}
          />
        </div>
      </form>

      <div className="mt-10">
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : loading ? (
          <div className="rounded-lg bg-surface p-5 shadow-sm sm:p-8" role="status" aria-label="Loading summary">
            <div className="h-3 w-16 animate-pulse rounded-full bg-surface-secondary" />
            <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
              <div className="h-12 animate-pulse rounded-lg bg-surface-secondary" />
              <div className="h-12 animate-pulse rounded-lg bg-surface-secondary" />
              <div className="h-12 animate-pulse rounded-lg bg-surface-secondary" />
              <div className="h-12 animate-pulse rounded-lg bg-surface-secondary" />
            </div>
          </div>
        ) : summary ? (
          <>
            {summary.attempts === 0 ? (
              <p className="mb-6 max-w-[32em] text-sm leading-relaxed text-muted">
                {emptyCopy}
              </p>
            ) : null}
            <DailySummaryPanel summary={summary} heading={formatDayHeading(date)} />
          </>
        ) : null}
      </div>
    </div>
  );
}
