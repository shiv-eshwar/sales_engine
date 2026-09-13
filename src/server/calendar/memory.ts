import type {
  CalendarBusySlot,
  CalendarClient,
  CalendarConnectionStatus,
  CalendarInsertInput,
  CalendarInsertResult
} from "./types.js";

export class FakeCalendarClient implements CalendarClient {
  readonly inserts: CalendarInsertInput[] = [];
  busy: CalendarBusySlot[] = [];
  throwOnInsert: Error | null = null;
  configured: boolean;
  connected: boolean;
  email: string | null;

  constructor(options: { connected?: boolean; configured?: boolean; email?: string | null } = {}) {
    this.connected = options.connected ?? false;
    this.configured = options.configured ?? true;
    this.email = options.email ?? (this.connected ? "operator@example.com" : null);
  }

  status(): CalendarConnectionStatus {
    return { configured: this.configured, connected: this.connected, email: this.email };
  }

  async getAvailability(_timeMin: string, _timeMax: string): Promise<CalendarBusySlot[]> {
    if (!this.connected) {
      throw new Error("Calendar is not connected");
    }
    return this.busy;
  }

  async insertEvent(input: CalendarInsertInput): Promise<CalendarInsertResult> {
    if (!this.connected) {
      throw new Error("Calendar is not connected");
    }
    if (this.throwOnInsert) {
      throw this.throwOnInsert;
    }
    this.inserts.push(input);
    const id = `evt-${this.inserts.length}`;
    return { id, htmlLink: `https://calendar.google.com/event?eid=${id}` };
  }

  disconnect(): void {
    this.connected = false;
    this.email = null;
  }
}
