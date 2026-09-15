import type { CalendarEventIntent, PublicCalendarProposal } from "../../shared/contracts.js";
import type { CalendarInsertInput } from "./types.js";

export type CalendarDraftFields = {
  intent: CalendarEventIntent;
  title: string;
  start: string;
  end: string;
  timezone: string;
  attendees: string[];
  meet: boolean;
  notes: string;
};

export function isOperatorOnlyIntent(intent: CalendarEventIntent): boolean {
  return intent === "callback" || intent === "reminder";
}

export function parseCalendarIntent(value: string | null | undefined): CalendarEventIntent {
  if (value === "callback" || value === "reminder") return value;
  return "meeting";
}

export function sanitizeCalendarDraft<T extends CalendarDraftFields>(draft: T): T {
  if (!isOperatorOnlyIntent(draft.intent)) {
    return draft;
  }
  return {
    ...draft,
    attendees: [],
    meet: false
  };
}

export function draftFromPublic(proposal: PublicCalendarProposal): CalendarDraftFields {
  return sanitizeCalendarDraft({
    intent: proposal.intent,
    title: proposal.title,
    start: proposal.start,
    end: proposal.end,
    timezone: proposal.timezone,
    attendees: proposal.attendees,
    meet: proposal.meet,
    notes: proposal.notes
  });
}

export function toCalendarInsertInput(draft: CalendarDraftFields): CalendarInsertInput {
  const clean = sanitizeCalendarDraft(draft);
  const operatorOnly = isOperatorOnlyIntent(clean.intent);
  return {
    title: clean.title,
    start: clean.start,
    end: clean.end,
    timezone: clean.timezone,
    attendees: clean.attendees,
    meet: clean.meet,
    notes: clean.notes,
    sendUpdates: operatorOnly ? "none" : "all",
    popupMinutes: operatorOnly ? 15 : null
  };
}
