import { Link } from "react-router-dom";
import type { BootstrapResponse } from "../../shared/contracts";
import type { DeviceStatus } from "../state/calls";

export type ReadinessKind = "ready" | "twilio" | "sheet";

export function readinessState(input: {
  sheet: BootstrapResponse["sheet"];
  twilioConfigured: boolean;
  deviceStatus: DeviceStatus;
}): { kind: ReadinessKind; label: string; tone: "ok" | "bad" } {
  if (input.sheet.status === "error" || input.sheet.status === "unconfigured") {
    return { kind: "sheet", label: "Sheet needs a fix", tone: "bad" };
  }
  if (!input.twilioConfigured || input.deviceStatus !== "registered") {
    return { kind: "twilio", label: "Can't call — Twilio off", tone: "bad" };
  }
  return { kind: "ready", label: "Ready to call", tone: "ok" };
}

export function ReadinessChip({
  sheet,
  twilioConfigured,
  deviceStatus,
  diagnosticCount
}: {
  sheet: BootstrapResponse["sheet"];
  twilioConfigured: boolean;
  deviceStatus: DeviceStatus;
  diagnosticCount: number;
}) {
  const state = readinessState({ sheet, twilioConfigured, deviceStatus });
  const blocking = state.kind === "sheet";

  return (
    <div
      className="flex min-w-0 items-center gap-3 text-sm"
      aria-label={blocking ? "Sheet blocking error" : state.kind === "ready" ? "Ready to call" : "Can't call — Twilio off"}
    >
      {state.kind !== "ready" ? (
        blocking && diagnosticCount > 0 ? (
          <Link to="/diagnostics" className="truncate font-medium text-danger hover:underline hover:underline-offset-4">
            {state.label}
          </Link>
        ) : (
          <span className="truncate font-medium text-danger">{state.label}</span>
        )
      ) : diagnosticCount > 0 ? (
        <Link to="/diagnostics" className="truncate font-medium text-muted hover:text-foreground hover:underline hover:underline-offset-4">
          Queue diagnostics ({diagnosticCount})
        </Link>
      ) : null}
      {twilioConfigured ? (
        <span className="sr-only" aria-label={`Twilio device ${deviceStatus}`}>
          Twilio device {deviceStatus}
        </span>
      ) : null}
    </div>
  );
}
