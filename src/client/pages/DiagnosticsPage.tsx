import { useSession } from "../state/session";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { diagnosticCopy } from "../copy";
import { Alert } from "@heroui/react";

export function DiagnosticsPage() {
  const { data } = useSession();
  const sheet = data.sheet;
  const blocking = sheet.status === "error" || sheet.status === "unconfigured";
  const issues = sheet.diagnostics;
  const usable = !blocking && issues.length === 0;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Ready", to: "/leads" }, { label: "Queue diagnostics" }]} />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Queue diagnostics</h1>
      <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">
        {blocking
          ? "The sheet needs a fix before calling."
          : issues.length > 0
            ? `${issues.length} row issue${issues.length === 1 ? "" : "s"} — some contacts were skipped.`
            : "The queue is usable."}
      </p>

      {issues.length === 0 ? (
        <Alert status={usable ? "success" : "warning"} className="mt-6">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {usable ? "Queue healthy. No diagnostics reported." : "No row diagnostics, but the sheet is not ready to call."}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : (
        <ul className="mt-6 max-w-xl space-y-3">
          {issues.map((item, index) => (
            <li key={`${item.code}-${index}`} className="rounded-lg bg-surface px-4 py-3 text-sm shadow-sm">
              {diagnosticCopy(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
