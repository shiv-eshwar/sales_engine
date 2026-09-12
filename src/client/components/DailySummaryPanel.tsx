import type { DailySummary } from "../../shared/contracts";

export function DailySummaryPanel({ summary }: { summary: DailySummary }) {
  if (summary.attempts === 0) {
    return null;
  }

  return (
    <section className="pt-2" aria-label="Daily summary">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Today</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 xl:grid-cols-6">
        <SummaryStat label="Attempts" value={summary.attempts} />
        <SummaryStat label="Connects" value={summary.connects} />
        <SummaryStat label="Qualified" value={summary.qualified} />
        <SummaryStat label="Disqualified" value={summary.disqualified} />
        <SummaryStat label="Unknown" value={summary.unknown} />
        <SummaryStat label="Meetings" value={summary.meetings} />
        <SummaryStat label="Follow-ups" value={summary.followUps} />
        <SummaryStat label="References" value={summary.references} />
        <SummaryStat label="Callbacks" value={summary.callbacks} />
        <SummaryStat label="No answer" value={summary.noAnswer} />
        <SummaryStat label="Busy" value={summary.busy} />
        <SummaryStat label="Failed" value={summary.failed} />
        <SummaryStat
          label="Talk ratio"
          value={
            summary.averageTalkRatio === null ? "—" : `${Math.round(summary.averageTalkRatio * 100)}%`
          }
        />
      </dl>
      {summary.coachingObservation ? (
        <p className="mt-5 max-w-[32em] text-sm leading-relaxed text-muted">{summary.coachingObservation}</p>
      ) : null}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
