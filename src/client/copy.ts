import type { SheetDiagnostic, WriteFieldKey } from "../shared/contracts";

export const PRODUCT_NAME = "Sales Engine";

export const SEMANTIC_OUTCOME_LABELS: Record<string, string> = {
  meeting_booked: "Meeting booked",
  permission_to_follow_up: "Follow-up allowed",
  reference_received: "Reference received",
  callback_later: "Callback later",
  not_interested: "Not interested",
  disqualified: "Disqualified",
  do_not_contact: "Do not contact",
  wrong_person: "Wrong person",
  wrong_number: "Wrong number",
  conversation_incomplete: "Conversation incomplete",
  unknown: "Unknown"
};

export const QUALIFICATION_LABELS: Record<string, string> = {
  qualified: "Qualified",
  disqualified: "Disqualified",
  defer: "Defer",
  unknown: "Unknown"
};

export const CALL_STATUS_OPTIONS = ["Completed", "Retry", "Do Not Contact", "Skipped"] as const;

export const FIELD_LABELS: Record<WriteFieldKey, string> = {
  call_status: "Call status",
  call_attempts: "Call attempts",
  last_called_at: "Last called",
  call_outcome: "Call outcome",
  qualification: "Qualification",
  qualification_reason: "Qualification reason",
  objections: "Objections",
  next_step: "Next step",
  follow_up_at: "Follow-up",
  call_summary: "Call summary",
  twilio_call_sid: "Twilio Call SID",
  recording_sid: "Recording SID"
};

export const TECHNICAL_FIELD_KEYS = new Set<WriteFieldKey>(["twilio_call_sid", "recording_sid"]);
export const DATETIME_FIELD_KEYS = new Set<WriteFieldKey>(["last_called_at", "follow_up_at"]);

export const AI_DISCONNECTED_COPY =
  "AI is not connected — ask whoever runs this box to finish setup.";

export function humanizeId(value: string): string {
  const cleaned = value.replaceAll("_", " ").trim();
  if (!cleaned) return value;
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function outcomeLabel(value: string): string {
  return SEMANTIC_OUTCOME_LABELS[value] ?? humanizeId(value);
}

export function qualificationLabel(value: string): string {
  return QUALIFICATION_LABELS[value] ?? humanizeId(value);
}

export function fieldLabel(key: WriteFieldKey, header?: string): string {
  if (header && header.trim() && header !== key) return header;
  return FIELD_LABELS[key] ?? humanizeId(key);
}

export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return trimmed;
  return new Date(timestamp).toLocaleString();
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatUtteranceText(text: string, startedAtMs: number, endedAtMs: number): string {
  if (text.trim() !== "[gap]") return text;
  return `Audio missed ${formatClock(startedAtMs)}–${formatClock(endedAtMs)}`;
}

export function diagnosticCopy(item: SheetDiagnostic): string {
  if (item.code === "blank_lead_id" && item.rowNumber) {
    return `Row ${item.rowNumber} has no Lead ID — skipped.`;
  }
  if (item.code === "duplicate_lead_id" && item.leadId) {
    return `Lead ID “${item.leadId}” appears more than once — skipped.`;
  }
  if (item.code === "invalid_phone") {
    const who = item.leadId ? item.leadId : item.rowNumber ? `Row ${item.rowNumber}` : "A lead";
    return `${who} has a phone that cannot be dialed.`;
  }
  return item.message;
}

export function nextLeadPath(lead: { leadId: string } | null | undefined): string {
  return lead ? `/leads/${encodeURIComponent(lead.leadId)}` : "/leads";
}

export function isWarningCue(cueType: string | undefined, text?: string, reason?: string): boolean {
  if (cueType === "warning") return true;
  const blob = `${text ?? ""} ${reason ?? ""}`.toLowerCase();
  return /\bdo not contact\b|\bdon't contact\b|\bstop calling\b/.test(blob);
}
