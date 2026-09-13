import type { DailySummary } from "../../shared/contracts";

const VOLUME: Array<{ label: string; value: (summary: DailySummary) => string | number }> = [
  { label: "Attempts", value: (summary) => summary.attempts },
  { label: "Connects", value: (summary) => summary.connects },
  {
    label: "Talk ratio",
    value: (summary) =>
      summary.averageTalkRatio === null ? "—" : `${Math.round(summary.averageTalkRatio * 100)}%`
  }
];

const QUALIFICATION: Array<{ label: string; value: (summary: DailySummary) => string | number }> = [
  { label: "Qualified", value: (summary) => summary.qualified },
  { label: "Disqualified", value: (summary) => summary.disqualified },
  { label: "Unknown", value: (summary) => summary.unknown }
];

const NEXT_STEPS: Array<{ label: string; value: (summary: DailySummary) => string | number }> = [
  { label: "Meetings", value: (summary) => summary.meetings },
  { label: "Follow-ups", value: (summary) => summary.followUps },
  { label: "References", value: (summary) => summary.references },
  { label: "Callbacks", value: (summary) => summary.callbacks }
];

const TRANSPORT: Array<{ label: string; value: (summary: DailySummary) => string | number }> = [
  { label: "No answer", value: (summary) => summary.noAnswer },
  { label: "Busy", value: (summary) => summary.busy },
  { label: "Failed", value: (summary) => summary.failed }
];

export function DailySummaryPanel({
  summary,
  heading
}: {
  summary: DailySummary;
  heading?: string;
}) {
  return (
    <section className="rounded-lg bg-surface p-5 shadow-sm sm:p-8" aria-label="Daily summary">
      {heading ? (
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{heading}</p>
      ) : null}
      <div className={heading ? "mt-6 space-y-8" : "space-y-8"}>
        <StatGroup stats={VOLUME} summary={summary} />
        <StatGroup stats={QUALIFICATION} summary={summary} />
        <StatGroup stats={NEXT_STEPS} summary={summary} />
        <StatGroup stats={TRANSPORT} summary={summary} />
      </div>
      {summary.coachingObservation ? (
        <p className="mt-8 max-w-[32em] text-sm leading-relaxed text-muted">{summary.coachingObservation}</p>
      ) : null}
    </section>
  );
}

function StatGroup({
  stats,
  summary
}: {
  stats: Array<{ label: string; value: (summary: DailySummary) => string | number }>;
  summary: DailySummary;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{stat.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{stat.value(summary)}</dd>
        </div>
      ))}
    </dl>
  );
}
