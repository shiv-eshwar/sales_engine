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
  const color = state.tone === "ok" ? "bg-emerald-500" : "bg-red-500";

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-slate-600"
      aria-label={blocking ? "Sheet blocking error" : state.kind === "ready" ? "Ready to call" : "Can't call — Twilio off"}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
        <strong className="font-semibold text-slate-800">{state.label}</strong>
      </span>
      {twilioConfigured ? (
        <span className="sr-only" aria-label={`Twilio device ${deviceStatus}`}>
          Twilio device {deviceStatus}
        </span>
      ) : null}
      {diagnosticCount > 0 ? (
        <Link to="/diagnostics" className="underline">
          {blocking ? "Sheet needs attention" : "Queue diagnostics"} ({diagnosticCount})
        </Link>
      ) : null}
    </div>
  );
}
