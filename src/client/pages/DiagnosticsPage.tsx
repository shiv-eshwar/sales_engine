import { useSession } from "../state/session";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { diagnosticCopy } from "../copy";

export function DiagnosticsPage() {
  const { data } = useSession();
  const sheet = data.sheet;
  const blocking = sheet.status === "error" || sheet.status === "unconfigured";
  const issues = sheet.diagnostics;
  const usable = !blocking && issues.length === 0;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Ready", to: "/leads" }, { label: "Queue diagnostics" }]} />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Queue diagnostics</h1>
      <p className="mt-1 text-sm text-slate-600">
        {blocking
          ? "The sheet needs a fix before calling."
          : issues.length > 0
            ? `${issues.length} row issue${issues.length === 1 ? "" : "s"} — some contacts were skipped.`
            : "The queue is usable."}
      </p>

      {issues.length === 0 ? (
        <section className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          {usable ? "Queue healthy. No diagnostics reported." : "No row diagnostics, but the sheet is not ready to call."}
        </section>
      ) : (
        <ul className="mt-5 space-y-2">
          {issues.map((item, index) => (
            <li
              key={`${item.code}-${index}`}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
            >
              <p>{diagnosticCopy(item)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
