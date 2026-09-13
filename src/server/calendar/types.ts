export type CalendarBusySlot = { start: string; end: string };

export type CalendarInsertInput = {
  title: string;
  start: string;
  end: string;
  timezone: string;
  attendees: string[];
  meet: boolean;
  notes: string;
};

export type CalendarInsertResult = {
  id: string;
  htmlLink: string;
};

export type CalendarConnectionStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
};

export interface CalendarClient {
  status(): CalendarConnectionStatus;
  getAvailability(timeMin: string, timeMax: string): Promise<CalendarBusySlot[]>;
  insertEvent(input: CalendarInsertInput): Promise<CalendarInsertResult>;
  disconnect?(): void;
}

export type CalendarProposalStatus = "pending" | "sent" | "dismissed" | "failed";
export type CalendarProposalSource = "live_coach" | "call_review";
