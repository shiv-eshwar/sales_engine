import { google } from "googleapis";
import type Database from "better-sqlite3";
import type { Env } from "../env.js";
import { deleteOAuthTokens, getOAuthTokens, saveOAuthTokens } from "./oauthStore.js";
import type {
  CalendarBusySlot,
  CalendarClient,
  CalendarConnectionStatus,
  CalendarInsertInput,
  CalendarInsertResult
} from "./types.js";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function calendarOAuthConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID?.trim() && env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

export function calendarRedirectUri(env: Env): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/api/google/calendar/callback`;
}

function oauth2(env: Env) {
  return new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    calendarRedirectUri(env)
  );
}

export function calendarAuthUrl(env: Env, state: string): string {
  return oauth2(env).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPE,
    state
  });
}

export class GoogleCalendarClient implements CalendarClient {
  constructor(
    private readonly env: Env,
    private readonly db: Database.Database
  ) {}

  status(): CalendarConnectionStatus {
    const configured = calendarOAuthConfigured(this.env);
    if (!configured || !this.env.SESSION_SECRET) {
      return { configured: false, connected: false, email: null };
    }
    const tokens = getOAuthTokens(this.db, this.env.SESSION_SECRET);
    return {
      configured: true,
      connected: Boolean(tokens?.refreshToken),
      email: tokens?.email ?? null
    };
  }

  async exchangeCode(code: string): Promise<void> {
    if (!this.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET is required to store Calendar tokens");
    }
    const client = oauth2(this.env);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token && !tokens.access_token) {
      throw new Error("Google did not return Calendar tokens");
    }
    const existing = getOAuthTokens(this.db, this.env.SESSION_SECRET);
    const refresh = tokens.refresh_token ?? existing?.refreshToken;
    if (!refresh) {
      throw new Error("Google did not return a refresh token. Disconnect and connect again.");
    }
    client.setCredentials(tokens);
    let email: string | null = existing?.email ?? null;
    try {
      const oauth = google.oauth2({ version: "v2", auth: client });
      const me = await oauth.userinfo.get();
      email = me.data.email ?? email;
    } catch {
      // email is optional
    }
    saveOAuthTokens(this.db, this.env.SESSION_SECRET, {
      email,
      refreshToken: refresh,
      accessToken: tokens.access_token ?? existing?.accessToken ?? null,
      accessExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    });
  }

  disconnect(): void {
    deleteOAuthTokens(this.db);
  }

  private authedClient() {
    if (!this.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET is required");
    }
    const stored = getOAuthTokens(this.db, this.env.SESSION_SECRET);
    if (!stored) {
      throw new Error("Calendar is not connected");
    }
    const client = oauth2(this.env);
    client.setCredentials({
      refresh_token: stored.refreshToken,
      access_token: stored.accessToken ?? undefined,
      expiry_date: stored.accessExpiresAt ? Date.parse(stored.accessExpiresAt) : undefined
    });
    client.on("tokens", (tokens) => {
      const nextRefresh = tokens.refresh_token ?? stored.refreshToken;
      saveOAuthTokens(this.db, this.env.SESSION_SECRET!, {
        email: stored.email,
        refreshToken: nextRefresh,
        accessToken: tokens.access_token ?? stored.accessToken,
        accessExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : stored.accessExpiresAt
      });
    });
    return client;
  }

  async getAvailability(timeMin: string, timeMax: string): Promise<CalendarBusySlot[]> {
    const auth = this.authedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const busy: CalendarBusySlot[] = [];
    let pageToken: string | undefined;
    do {
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
        pageToken
      });
      for (const event of response.data.items ?? []) {
        if (event.status === "cancelled" || event.transparency === "transparent") continue;
        if (event.attendees?.some((person) => person.self && person.responseStatus === "declined")) continue;
        const start = event.start?.dateTime ?? event.start?.date;
        const end = event.end?.dateTime ?? event.end?.date;
        if (start && end) busy.push({ start, end });
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    return busy;
  }

  async insertEvent(input: CalendarInsertInput): Promise<CalendarInsertResult> {
    const auth = this.authedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: input.meet ? 1 : 0,
      sendUpdates: input.sendUpdates,
      requestBody: {
        summary: input.title,
        description: input.notes || undefined,
        start: { dateTime: input.start, timeZone: input.timezone },
        end: { dateTime: input.end, timeZone: input.timezone },
        attendees: input.attendees.map((email) => ({ email })),
        reminders: input.popupMinutes
          ? {
              useDefault: false,
              overrides: [{ method: "popup", minutes: input.popupMinutes }]
            }
          : undefined,
        conferenceData: input.meet
          ? {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" }
              }
            }
          : undefined
      }
    });
    const id = response.data.id;
    const htmlLink = response.data.htmlLink;
    if (!id || !htmlLink) {
      throw new Error("Google Calendar did not return an event id");
    }
    return { id, htmlLink };
  }
}

export function createCalendarClient(env: Env, db: Database.Database): CalendarClient {
  if (calendarOAuthConfigured(env)) {
    return new GoogleCalendarClient(env, db);
  }
  return {
    status: () => ({ configured: false, connected: false, email: null }),
    async getAvailability() {
      throw new Error("Calendar OAuth is not configured");
    },
    async insertEvent() {
      throw new Error("Calendar OAuth is not configured");
    }
  };
}
