import type { DailySummary } from "../../shared/contracts";

const HERO: Array<{ label: string; value: (summary: DailySummary) => string | number }> = [
  { label: "Attempts", value: (summary) => summary.attempts },
  { label: "Connects", value: (summary) => summary.connects },
  {
    label: "Talk ratio",
    value: (summary) =>
      summary.averageTalkRatio === null ? "—" : `${Math.round(summary.averageTalkRatio * 100)}%`
  }
];

const GROUPS: Array<{
  title: string;
  stats: Array<{ label: string; value: (summary: DailySummary) => string | number }>;
}> = [
  {
    title: "Qualification",
    stats: [
      { label: "Qualified", value: (summary) => summary.qualified },
      { label: "Disqualified", value: (summary) => summary.disqualified },
      { label: "Unknown", value: (summary) => summary.unknown }
    ]
  },
  {
    title: "Next steps",
    stats: [
      { label: "Meetings", value: (summary) => summary.meetings },
      { label: "Follow-ups", value: (summary) => summary.followUps },
      { label: "References", value: (summary) => summary.references },
      { label: "Callbacks", value: (summary) => summary.callbacks }
    ]
  },
  {
    title: "Didn't connect",
    stats: [
      { label: "No answer", value: (summary) => summary.noAnswer },
      { label: "Busy", value: (summary) => summary.busy },
      { label: "Failed", value: (summary) => summary.failed }
    ]
  }
];

function isQuiet(value: string | number): boolean {
  return value === 0 || value === "—" || value === "0%";
}

export function DailySummaryPanel({
  summary,
  emptyCopy
}: {
  summary: DailySummary;
  emptyCopy?: string;
}) {
  return (
    <section className="rounded-lg bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-10 lg:py-10" aria-label="Daily summary">
      {emptyCopy ? (
        <p className="mb-8 max-w-[36em] text-sm leading-relaxed text-muted">{emptyCopy}</p>
      ) : null}
      <dl className="grid grid-cols-3 gap-6 lg:gap-10">
        {HERO.map((stat) => {
          const value = stat.value(summary);
          return (
            <div key={stat.label} className="min-w-0">
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd
                className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${
                  isQuiet(value) ? "text-muted" : "text-foreground"
                }`}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="mt-10 space-y-8">
        {GROUPS.map((group) => (
          <div key={group.title} className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">{group.title}</p>
            <dl
              className={`mt-4 grid gap-6 ${
                group.stats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
              }`}
            >
              {group.stats.map((stat) => {
                const value = stat.value(summary);
                return (
                  <div key={stat.label} className="min-w-0">
                    <dt className="text-sm text-muted">{stat.label}</dt>
                    <dd
                      className={`mt-1 text-xl font-semibold tabular-nums ${
                        isQuiet(value) ? "text-muted" : "text-foreground"
                      }`}
                    >
                      {value}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
      {summary.coachingObservation ? (
        <p className="mt-10 max-w-[36em] text-sm leading-relaxed text-muted">{summary.coachingObservation}</p>
      ) : null}
    </section>
  );
}
