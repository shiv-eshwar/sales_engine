import type { DailySummary } from "../../shared/contracts";
import { Card } from "@heroui/react";

export function DailySummaryPanel({ summary }: { summary: DailySummary }) {
  if (summary.attempts === 0) {
    return null;
  }

  return (
    <Card className="mt-8" aria-label="Daily summary">
      <Card.Header>
        <p className="text-muted text-sm font-medium uppercase tracking-wide">Today</p>
      </Card.Header>
      <Card.Content>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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
          <p className="mt-3 text-sm">Observation: {summary.coachingObservation}</p>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-muted text-xs uppercase tracking-wide">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
