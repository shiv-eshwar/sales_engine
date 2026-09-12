import { Link } from "react-router-dom";
import type { BootstrapResponse } from "../../shared/contracts";
import type { DeviceStatus } from "../state/calls";
import { Chip } from "@heroui/react";

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
      className="text-muted flex flex-wrap items-center gap-2 text-xs"
      aria-label={blocking ? "Sheet blocking error" : state.kind === "ready" ? "Ready to call" : "Can't call — Twilio off"}
    >
      <Chip color={state.tone === "ok" ? "success" : "danger"} variant="soft" size="sm">
        <Chip.Label>{state.label}</Chip.Label>
      </Chip>
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
