import type { DailySummary } from "../../shared/contracts";

export function DailySummaryPanel({ summary }: { summary: DailySummary }) {
  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4" aria-label="Daily summary">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Today</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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
          label="Avg talk ratio"
          value={
            summary.averageTalkRatio === null ? "—" : `${Math.round(summary.averageTalkRatio * 100)}% caller`
          }
        />
      </dl>
      {summary.coachingObservation ? (
        <p className="mt-3 text-sm text-slate-700">Observation: {summary.coachingObservation}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No coaching observation yet today.</p>
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
