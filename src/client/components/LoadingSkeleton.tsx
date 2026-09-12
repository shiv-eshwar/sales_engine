export function LoadingSkeleton({
  title = "Loading…",
  detail,
  lines = 3,
}: {
  title?: string;
  detail?: string;
  lines?: number;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label={title}>
      <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-md">
        <div className="flex items-baseline gap-3">
          <span
            aria-hidden="true"
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent"
          />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        {detail ? <p className="mt-2 text-sm text-muted">{detail}</p> : null}
        <div className="mt-5 space-y-2" aria-hidden="true">
          {Array.from({ length: lines }).map((_, index) => (
            <div
              key={index}
              className="h-3 animate-pulse rounded-full bg-surface-secondary"
              style={{ width: `${[92, 78, 86, 64, 72][index % 5]}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
