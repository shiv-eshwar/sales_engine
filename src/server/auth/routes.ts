import "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../context.js";
import { cookieSecure } from "../env.js";
import { sessionCookie } from "./session.js";

/**
 * Auth is open for this single-user operator: no password gate.
 * Login still sets a cookie so older tests that expect Set-Cookie keep working.
 */
export async function registerAuth(app: import("fastify").FastifyInstance, ctx: AppContext): Promise<void> {
  app.post("/api/login", async (_request, reply) => {
    reply.setCookie(sessionCookie.name, "open-access", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(ctx.env),
      maxAge: sessionCookie.maxAge
    });
    return { ok: true };
  });

  app.post("/api/logout", async (_request, reply) => {
    reply.clearCookie(sessionCookie.name, { path: "/" });
    return { ok: true };
  });

  app.get("/api/session", async () => ({ authenticated: true }));
}

export function isAuthenticated(_ctx: AppContext, _request: FastifyRequest): boolean {
  return true;
}

export async function requireSession(
  _ctx: AppContext,
  _request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Open access — no session cookie required.
}
