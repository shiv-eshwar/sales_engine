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

export function draftFromUnknown(
  raw: {
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
  if (!raw.start || !raw.end) return null;
  return {
    title: raw.title?.trim() || fallbackTitle,
    start: raw.start,
    end: raw.end,
    timezone: raw.timezone?.trim() || "UTC",
    attendees: normalizeAttendees(raw.attendees ?? []),
    meet: Boolean(raw.meet),
    notes: raw.notes?.trim() ?? ""
  };
}
