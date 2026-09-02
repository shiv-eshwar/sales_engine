import type { SheetsConfig, PostCallOutcome } from "../../shared/schemas.js";
import type { WriteFields } from "../../shared/types.js";
import type { PublicProposalDiff, WriteFieldKey } from "../../shared/contracts.js";

export const DNC_CALL_STATUS = "Do Not Contact";
export const COMPLETED_CALL_STATUS = "Completed";
export const RETRY_CALL_STATUS = "Retry";
export const SKIPPED_CALL_STATUS = "Skipped";

const WRITE_KEYS: WriteFieldKey[] = [
  "call_status",
  "call_attempts",
  "last_called_at",
  "call_outcome",
  "qualification",
  "qualification_reason",
  "objections",
  "next_step",
  "follow_up_at",
  "call_summary",
  "twilio_call_sid",
  "recording_sid"
];

export function incrementAttempts(current: string | undefined): string {
  const parsed = Number.parseInt((current ?? "").trim() || "0", 10);
  return String(Number.isFinite(parsed) && parsed >= 0 ? parsed + 1 : 1);
}

export function currentWriteFields(
  config: SheetsConfig,
  cells: Record<string, string>
): Record<WriteFieldKey, string> {
  const result = {} as Record<WriteFieldKey, string>;
  for (const key of WRITE_KEYS) {
    result[key] = cells[config.write_columns[key]] ?? "";
  }
  return result;
}

export function fieldDiff(
  config: SheetsConfig,
  current: Record<string, string>,
  proposed: Record<string, string>
): PublicProposalDiff[] {
  return WRITE_KEYS.map((key) => {
    const currentValue = current[key] ?? "";
    const proposedValue = proposed[key] ?? currentValue;
    return {
      key,
      header: config.write_columns[key],
      current: currentValue,
      proposed: proposedValue,
      changed: proposedValue !== currentValue
    };
  });
}

export function writeFieldsFromProposed(proposed: Record<string, string>, current: Record<string, string>): WriteFields {
  const fields: WriteFields = {};
  for (const key of WRITE_KEYS) {
    const value = proposed[key];
    if (value === undefined) {
      continue;
    }
    if (value === (current[key] ?? "")) {
      continue;
    }
    fields[key] = value;
  }
  return fields;
}

export function transportFields(input: {
  current: Record<WriteFieldKey, string>;
  transportOutcome: string;
  callStatus: string;
  nowIso: string;
  twilioSid: string | null;
  recordingSid: string | null;
}): Record<WriteFieldKey, string> {
  return {
    ...input.current,
    call_status: input.callStatus,
    call_attempts: incrementAttempts(input.current.call_attempts),
    last_called_at: input.nowIso,
    call_outcome: input.transportOutcome,
    twilio_call_sid: input.twilioSid ?? input.current.twilio_call_sid,
    recording_sid: input.recordingSid ?? input.current.recording_sid
  };
}

export function connectedFields(input: {
  current: Record<WriteFieldKey, string>;
  outcome: PostCallOutcome;
  nowIso: string;
  twilioSid: string | null;
  recordingSid: string | null;
}): Record<WriteFieldKey, string> {
  const dnc = input.outcome.semanticOutcome === "do_not_contact";
  return {
    ...input.current,
    call_status: dnc ? DNC_CALL_STATUS : COMPLETED_CALL_STATUS,
    call_attempts: incrementAttempts(input.current.call_attempts),
    last_called_at: input.nowIso,
    call_outcome: input.outcome.semanticOutcome,
    qualification: input.outcome.qualification,
    qualification_reason: input.outcome.qualificationReason,
    objections: input.outcome.objections.join("; "),
    next_step: input.outcome.nextStep,
    follow_up_at: input.outcome.followUpAt ?? "",
    call_summary: input.outcome.summary,
    twilio_call_sid: input.twilioSid ?? input.current.twilio_call_sid,
    recording_sid: input.recordingSid ?? input.current.recording_sid
  };
}

export function applyFieldEdits(
  currentProposed: Record<string, string>,
  edits: Partial<Record<WriteFieldKey, string>> | undefined
): Record<string, string> {
  if (!edits) {
    return { ...currentProposed };
  }
  const next = { ...currentProposed };
  for (const [key, value] of Object.entries(edits)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  if (next.call_outcome === "do_not_contact") {
    next.call_status = DNC_CALL_STATUS;
  }
  return next;
}
