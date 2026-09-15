import type { CalendarEventIntent } from "../../shared/contracts.js";
import { parseCalendarIntent, sanitizeCalendarDraft } from "./insert.js";
import type { CalendarProposalDraft } from "./proposals.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEventTimes(start: string, end: string): string | null {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "Start and end must be valid timestamps";
  }
  if (endMs <= startMs) {
    return "End must be after start";
  }
  return null;
}

export function normalizeAttendees(values: string[] | undefined): string[] {
  const unique = new Set<string>();
  for (const value of values ?? []) {
    const email = value.trim().toLowerCase();
    if (email && EMAIL.test(email)) unique.add(email);
  }
  return [...unique];
}

export function defaultEventTitle(name: string, company: string): string {
  const who = name.trim() || "Meeting";
  const org = company.trim();
  return org ? `${who} / ${org}` : who;
}

function defaultEndIso(start: string): string | null {
  const startMs = Date.parse(start);
  if (Number.isNaN(startMs)) return null;
  return new Date(startMs + 15 * 60 * 1000).toISOString();
}

export function draftFromUnknown(
  raw: {
    intent?: CalendarEventIntent | string | null;
    title?: string | null;
    start?: string;
    end?: string;
    timezone?: string | null;
    attendees?: string[] | null;
    meet?: boolean | null;
    notes?: string | null;
  },
  fallbackTitle: string
): CalendarProposalDraft | null {
  if (!raw.start) return null;
  const intent = parseCalendarIntent(typeof raw.intent === "string" ? raw.intent : undefined);
  const end = raw.end || (intent === "meeting" ? undefined : defaultEndIso(raw.start) ?? undefined);
  if (!end) return null;
  return sanitizeCalendarDraft({
    intent,
    title: raw.title?.trim() || fallbackTitle,
    start: raw.start,
    end,
    timezone: raw.timezone?.trim() || "UTC",
    attendees: normalizeAttendees(raw.attendees ?? []),
    meet: Boolean(raw.meet),
    notes: raw.notes?.trim() ?? ""
  });
}
