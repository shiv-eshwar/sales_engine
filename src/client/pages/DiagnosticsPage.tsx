import { useSession } from "../state/session";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { diagnosticDetail, diagnosticHeading, diagnosticMeta } from "../copy";
import { Icon } from "../components/Icon";
import { Alert } from "@heroui/react";
import type { SheetDiagnostic } from "../../shared/contracts";

function diagnosticIcon(code: SheetDiagnostic["code"]): "phoneOff" | "copy" | "userOff" | "row" {
  if (code === "invalid_phone") return "phoneOff";
  if (code === "duplicate_lead_id") return "copy";
  if (code === "blank_lead_id") return "userOff";
  return "row";
}

export function DiagnosticsPage() {
  const { data } = useSession();
  const sheet = data.sheet;
  const blocking = sheet.status === "error" || sheet.status === "unconfigured";
  const issues = sheet.diagnostics;
  const usable = !blocking && issues.length === 0;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Home", to: "/leads" }, { label: "Queue diagnostics" }]} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:mt-8">Queue diagnostics</h1>
      <p className="mt-3 max-w-[32em] text-sm leading-relaxed text-muted">
        {blocking
          ? "The sheet needs a fix before calling."
          : issues.length > 0
            ? `${issues.length} contact${issues.length === 1 ? "" : "s"} skipped.`
            : "The queue is usable."}
      </p>

      {issues.length === 0 ? (
        <Alert status={usable ? "success" : "warning"} className="mt-10 max-w-xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {usable ? "Queue healthy. No diagnostics reported." : "No row diagnostics, but the sheet is not ready to call."}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {issues.map((item, index) => {
            const meta = diagnosticMeta(item);
            return (
              <li key={`${item.code}-${index}`} className="rounded-lg bg-surface px-5 py-5 shadow-sm sm:px-7 sm:py-7">
                <div className="flex items-start gap-3">
                  <Icon
                    name={diagnosticIcon(item.code)}
                    className={item.code === "invalid_phone" ? "mt-1 text-danger" : "mt-1 text-muted"}
                    title={diagnosticDetail(item)}
                  />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tracking-tight">{diagnosticHeading(item)}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{diagnosticDetail(item)}</p>
                    {meta ? <p className="mt-4 text-sm text-muted">{meta}</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
