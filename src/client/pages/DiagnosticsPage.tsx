import { useSession } from "../state/session";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { diagnosticCopy } from "../copy";
import { Alert, Card } from "@heroui/react";

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
      <p className="text-muted mt-1 text-sm">
        {blocking
          ? "The sheet needs a fix before calling."
          : issues.length > 0
            ? `${issues.length} row issue${issues.length === 1 ? "" : "s"} — some contacts were skipped.`
            : "The queue is usable."}
      </p>

      {issues.length === 0 ? (
        <Alert status={usable ? "success" : "warning"} className="mt-5">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {usable ? "Queue healthy. No diagnostics reported." : "No row diagnostics, but the sheet is not ready to call."}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : (
        <ul className="mt-5 space-y-2">
          {issues.map((item, index) => (
            <li key={`${item.code}-${index}`}>
              <Card>
                <Card.Content className="text-sm">{diagnosticCopy(item)}</Card.Content>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
