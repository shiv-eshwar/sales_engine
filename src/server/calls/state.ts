export const CALL_STATUSES = [
  "created",
  "queued",
  "ringing",
  "in_progress",
  "completed",
  "busy",
  "failed",
  "no-answer",
  "canceled"
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export const ACTIVE_CALL_STATUSES: CallStatus[] = ["created", "queued", "ringing", "in_progress"];
export const TERMINAL_CALL_STATUSES: CallStatus[] = [
  "completed",
  "busy",
  "failed",
  "no-answer",
  "canceled"
];

const RANK: Record<CallStatus, number> = {
  created: 0,
  queued: 1,
  ringing: 2,
  in_progress: 3,
  completed: 4,
  busy: 4,
  failed: 4,
  "no-answer": 4,
  canceled: 4
};

export function isActiveStatus(status: CallStatus): boolean {
  return ACTIVE_CALL_STATUSES.includes(status);
}

export function isTerminalStatus(status: CallStatus): boolean {
  return TERMINAL_CALL_STATUSES.includes(status);
}

export function parseTwilioCallStatus(raw: string | undefined): CallStatus | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase().replaceAll("_", "-");
  switch (normalized) {
    case "initiated":
      return "queued";
    case "queued":
      return "queued";
    case "ringing":
      return "ringing";
    case "answered":
    case "in-progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "failed":
      return "failed";
    case "no-answer":
      return "no-answer";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return null;
  }
}

export type TransitionResult =
  | { ok: true; status: CallStatus; changed: boolean }
  | { ok: false; reason: "illegal" | "stale"; status: CallStatus };

export function applyStatusTransition(current: CallStatus, next: CallStatus): TransitionResult {
  if (current === next) {
    return { ok: true, status: current, changed: false };
  }
  if (isTerminalStatus(current)) {
    return { ok: false, reason: "stale", status: current };
  }
  if (RANK[next] < RANK[current]) {
    return { ok: false, reason: "stale", status: current };
  }
  return { ok: true, status: next, changed: true };
}
