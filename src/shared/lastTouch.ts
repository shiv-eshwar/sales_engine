export type PublicLastTouch = {
  dials: number;
  conversations: number;
  lastDialAt: string | null;
  lastDialOutcome: string | null;
  lastDialer: string | null;
  lastDialConnected: boolean;
  lastConversationAt: string | null;
  lastConversationBy: string | null;
  lastSummary: string | null;
  objections: string | null;
  nextStep: string | null;
  followUpAt: string | null;
  followUpPending: boolean;
  unwritten: boolean;
};

export type LastTouchSession = {
  id: string;
  status: string;
  connectedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  transportOutcome: string | null;
  operatorEmail: string | null;
};

export type LastTouchSheet = {
  call_attempts: string;
  last_called_at: string;
  call_outcome: string;
  call_summary: string;
  objections: string;
  next_step: string;
  follow_up_at: string;
};

const TERMINAL = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

function parseAttempts(value: string): number {
  const n = Number.parseInt((value ?? "").trim() || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function nonempty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function later(a: string | null, b: string | null): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

export function callerLabel(email: string | null | undefined): string | null {
  const value = nonempty(email);
  if (!value) return null;
  const local = value.split("@")[0]?.replace(/\+.*$/, "") ?? "";
  return local || value;
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatTouchDate(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function outcomePhrase(value: string | null, connected: boolean): string | null {
  if (connected) return "connected";
  if (!value) return null;
  if (value === "completed") return "connected";
  if (value === "no-answer") return "no-answer";
  return value.replaceAll("_", " ");
}

export function assembleLastTouch(input: {
  sheet: LastTouchSheet;
  sessions: LastTouchSession[];
  proposalBySession?: Record<string, string>;
  nowMs?: number;
}): PublicLastTouch | null {
  const nowMs = input.nowMs ?? Date.now();
  const proposalBySession = input.proposalBySession ?? {};
  const terminal = input.sessions
    .filter((session) => TERMINAL.has(session.status))
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const connected = terminal.filter((session) => Boolean(session.connectedAt));
  const lastTerminal = terminal.at(-1) ?? null;
  const lastConnected = connected.at(-1) ?? null;

  const sheetAttempts = parseAttempts(input.sheet.call_attempts);
  const dials = Math.max(sheetAttempts, terminal.length);
  const conversations = connected.length > 0 ? connected.length : nonempty(input.sheet.call_summary) ? 1 : 0;
  const lastDialAt = lastTerminal?.endedAt ?? lastTerminal?.createdAt ?? nonempty(input.sheet.last_called_at);
  const lastDialConnected = Boolean(lastTerminal?.connectedAt);
  const lastDialOutcome =
    lastTerminal?.transportOutcome ??
    (lastTerminal ? lastTerminal.status : null) ??
    nonempty(input.sheet.call_outcome);
  const lastDialer = nonempty(lastTerminal?.operatorEmail) ?? nonempty(lastConnected?.operatorEmail);
  const lastConversationAt = lastConnected?.connectedAt ?? (nonempty(input.sheet.call_summary) ? nonempty(input.sheet.last_called_at) : null);
  const lastConversationBy = nonempty(lastConnected?.operatorEmail);
  const lastSummary = nonempty(input.sheet.call_summary);
  const followUpAt = nonempty(input.sheet.follow_up_at);
  const followMs = followUpAt ? Date.parse(followUpAt) : Number.NaN;
  const followUpPending = Number.isFinite(followMs) && followMs > nowMs;
  const applied = lastTerminal ? proposalBySession[lastTerminal.id] === "applied" : false;
  const unwritten = Boolean(
    lastTerminal &&
      !applied &&
      (!nonempty(input.sheet.last_called_at) || later(lastTerminal.createdAt, input.sheet.last_called_at))
  );

  if (dials === 0 && !lastDialAt && !lastSummary && !followUpAt) {
    return null;
  }

  return {
    dials,
    conversations,
    lastDialAt,
    lastDialOutcome,
    lastDialer,
    lastDialConnected,
    lastConversationAt,
    lastConversationBy,
    lastSummary,
    objections: nonempty(input.sheet.objections),
    nextStep: nonempty(input.sheet.next_step),
    followUpAt,
    followUpPending,
    unwritten
  };
}

export function lastTouchFingerprint(touch: PublicLastTouch | null | undefined): string {
  if (!touch) return "";
  return JSON.stringify([
    touch.dials,
    touch.conversations,
    touch.lastDialAt,
    touch.lastDialOutcome,
    touch.lastDialer,
    touch.lastDialConnected,
    touch.lastConversationAt,
    touch.lastConversationBy,
    touch.lastSummary,
    touch.objections,
    touch.followUpAt,
    touch.followUpPending,
    touch.unwritten
  ]);
}

export function formatLastTouchLine(touch: PublicLastTouch): string {
  const who = callerLabel(touch.lastDialer);
  if (touch.followUpPending && touch.followUpAt) {
    const when = formatTouchDate(touch.followUpAt);
    return ["Wait", when ? `follow up ${when}` : "follow up scheduled", who].filter(Boolean).join(" · ");
  }
  const parts: string[] = [];
  if (touch.dials > 0) parts.push(`${ordinal(touch.dials)} dial`);
  if (who) parts.push(who);
  const when = formatTouchDate(touch.lastDialAt);
  const outcome = outcomePhrase(touch.lastDialOutcome, touch.lastDialConnected);
  if (outcome && when) parts.push(`${outcome} ${when}`);
  else if (outcome) parts.push(outcome);
  else if (when) parts.push(when);
  if (touch.unwritten) parts.push("not written");
  return parts.join(" · ");
}
