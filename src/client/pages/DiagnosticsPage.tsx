import { useSession } from "../state/session";
import { Breadcrumbs } from "../components/Breadcrumbs";

export function DiagnosticsPage() {
  const { data } = useSession();
  const sheet = data.sheet;
  const blocking = sheet.status === "error" || sheet.status === "unconfigured";

  return (
    <div>
      <Breadcrumbs items={[{ label: "Leads", to: "/leads" }, { label: "Queue diagnostics" }]} />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Queue diagnostics</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sheet status: <strong className="font-semibold text-slate-800">{sheet.status}</strong>
        {blocking ? " — the queue needs attention before calling." : " — the queue is usable."}
      </p>

      {sheet.diagnostics.length === 0 ? (
        <section className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          Queue healthy. No diagnostics reported.
        </section>
      ) : (
        <ul className="mt-5 space-y-2">
          {sheet.diagnostics.map((item, index) => (
            <li
              key={`${item.code}-${index}`}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-wide">{item.code}</p>
              <p className="mt-1">{item.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
