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
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
          />
          <p className="text-sm font-medium text-slate-800">{title}</p>
        </div>
        {detail ? <p className="mt-2 text-sm text-slate-600">{detail}</p> : null}
        <div className="mt-4 space-y-2" aria-hidden="true">
          {Array.from({ length: lines }).map((_, index) => (
            <div
              key={index}
              className="h-3 animate-pulse rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100"
              style={{ width: `${[92, 78, 86, 64, 72][index % 5]}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
