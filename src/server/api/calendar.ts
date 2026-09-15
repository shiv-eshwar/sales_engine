import type { FastifyInstance } from "fastify";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { calendarProposalPatchSchema } from "../../shared/schemas.js";
import type { AppContext } from "../context.js";
import { requireSession } from "../auth/routes.js";
import { cookieSecure } from "../env.js";
import {
  calendarAuthUrl,
  calendarOAuthConfigured,
  GoogleCalendarClient
} from "../calendar/google.js";
import { normalizeAttendees, validateEventTimes } from "../calendar/draft.js";
import { draftFromPublic, toCalendarInsertInput } from "../calendar/insert.js";
import {
  getCalendarProposal,
  listCalendarProposals,
  markCalendarProposalDismissed,
  markCalendarProposalFailed,
  markCalendarProposalSent,
  updateCalendarProposalDraft
} from "../calendar/proposals.js";

const OAUTH_COOKIE = "gcal_oauth_state";

function signState(secret: string, nonce: string): string {
  const mac = createHmac("sha256", secret).update(nonce).digest("base64url");
  return `${nonce}.${mac}`;
}

function verifyState(secret: string, state: string): boolean {
  const [nonce, mac] = state.split(".");
  if (!nonce || !mac) return false;
  const expected = createHmac("sha256", secret).update(nonce).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function registerCalendarApi(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };

  app.get("/api/google/calendar/status", { preHandler: auth }, async () => ctx.calendar.status());

  app.get("/api/google/calendar/connect", { preHandler: auth }, async (_request, reply) => {
    if (!calendarOAuthConfigured(ctx.env) || !ctx.env.SESSION_SECRET) {
      return reply.code(503).send({ error: "Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and SESSION_SECRET." });
    }
    const nonce = randomBytes(16).toString("hex");
    const state = signState(ctx.env.SESSION_SECRET, nonce);
    reply.setCookie(OAUTH_COOKIE, state, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(ctx.env),
      maxAge: 600
    });
    return reply.redirect(calendarAuthUrl(ctx.env, state));
  });

  app.get("/api/google/calendar/callback", { preHandler: auth }, async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const origin = ctx.env.APP_BASE_URL.replace(/\/$/, "");
    if (query.error) {
      return reply.redirect(`${origin}/settings?calendar=denied`);
    }
    const cookieState = request.cookies[OAUTH_COOKIE];
    if (!query.code || !query.state || !cookieState || query.state !== cookieState || !ctx.env.SESSION_SECRET) {
      return reply.code(400).send({ error: "Invalid Calendar OAuth callback" });
    }
    if (!verifyState(ctx.env.SESSION_SECRET, query.state)) {
      return reply.code(400).send({ error: "Invalid Calendar OAuth state" });
    }
    const client = ctx.calendar instanceof GoogleCalendarClient ? ctx.calendar : new GoogleCalendarClient(ctx.env, ctx.db);
    try {
      await client.exchangeCode(query.code);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Calendar connect failed" });
    }
    reply.clearCookie(OAUTH_COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(ctx.env)
    });
    return reply.redirect(`${origin}/settings?calendar=connected`);
  });

  app.post("/api/google/calendar/disconnect", { preHandler: auth }, async () => {
    ctx.calendar.disconnect?.();
    return ctx.calendar.status();
  });

  app.get("/api/calls/:id/calendar/proposals", { preHandler: auth }, async (request) => {
    const { id } = request.params as { id: string };
    return { proposals: listCalendarProposals(ctx.db, id) };
  });

  app.post("/api/calendar/proposals/:id/approve", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = calendarProposalPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid event fields" });
    }
    const current = getCalendarProposal(ctx.db, id);
    if (!current) {
      return reply.code(404).send({ error: "Calendar proposal not found" });
    }
    if (current.status === "sent") {
      return { proposal: current };
    }
    if (current.status === "dismissed") {
      return reply.code(409).send({ error: "This event was dismissed" });
    }
    const status = ctx.calendar.status();
    if (!status.connected) {
      return reply.code(409).send({ error: "Connect Google Calendar before approving an invite." });
    }
    const attendees = parsed.data.attendees ? normalizeAttendees(parsed.data.attendees) : current.attendees;
    const updated = updateCalendarProposalDraft(ctx.db, id, {
      title: parsed.data.title,
      start: parsed.data.start,
      end: parsed.data.end,
      timezone: parsed.data.timezone,
      attendees,
      meet: parsed.data.meet,
      notes: parsed.data.notes ?? undefined
    }) ?? current;
    const times = validateEventTimes(updated.start, updated.end);
    if (times) {
      return reply.code(400).send({ error: times });
    }
    try {
      const inserted = await ctx.calendar.insertEvent(toCalendarInsertInput(draftFromPublic(updated)));
      return { proposal: markCalendarProposalSent(ctx.db, id, inserted) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Calendar insert failed";
      return reply.code(502).send({ error: message, proposal: markCalendarProposalFailed(ctx.db, id, message) });
    }
  });

  app.post("/api/calendar/proposals/:id/dismiss", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = getCalendarProposal(ctx.db, id);
    if (!current) {
      return reply.code(404).send({ error: "Calendar proposal not found" });
    }
    if (current.status === "sent") {
      return reply.code(409).send({ error: "This invite was already sent" });
    }
    return { proposal: markCalendarProposalDismissed(ctx.db, id) };
  });
}
