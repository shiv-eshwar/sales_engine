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
  if (!input.twilioConfigured) {
    return { kind: "twilio", label: "Voice setup required", tone: "bad" };
  }
  if (input.deviceStatus !== "registered") {
    const label = input.deviceStatus === "registering" ? "Connecting voice…"
      : input.deviceStatus === "error" ? "Voice connection issue — see Settings" : "Reconnecting voice…";
    return { kind: "twilio", label, tone: "bad" };
  }
  return { kind: "ready", label: "Ready to call", tone: "ok" };
}

export function ReadinessChip({
  sheet,
  twilioConfigured,
  deviceStatus
}: {
  sheet: BootstrapResponse["sheet"];
  twilioConfigured: boolean;
  deviceStatus: DeviceStatus;
}) {
  const state = readinessState({ sheet, twilioConfigured, deviceStatus });
  const blocking = state.kind === "sheet";

  return (
    <div
      className="flex min-w-0 items-center gap-3 text-sm"
      aria-label={state.label}
    >
      {state.kind !== "ready" ? (
        blocking ? (
          <Link to="/notifications#queue" className="truncate font-medium text-danger hover:underline hover:underline-offset-4">
            {state.label}
          </Link>
        ) : (
          <Link to="/settings" className="truncate font-medium text-danger hover:underline hover:underline-offset-4">
            {state.label}
          </Link>
        )
      ) : null}
      {twilioConfigured ? (
        <span className="sr-only" aria-label={`Twilio device ${deviceStatus}`}>
          Twilio device {deviceStatus}
        </span>
      ) : null}
    </div>
  );
}
