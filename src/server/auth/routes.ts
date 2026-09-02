import "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../context.js";
import { cookieSecure } from "../env.js";
import { verifyPassword } from "./password.js";
import { createSessionToken, readSessionToken, sessionCookie } from "./session.js";
import { loginRequestSchema } from "../../shared/schemas.js";

export async function registerAuth(app: import("fastify").FastifyInstance, ctx: AppContext): Promise<void> {
  app.post("/api/login", async (request, reply) => {
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Password is required" });
    }
    const hash = ctx.env.APP_PASSWORD_HASH;
    const secret = ctx.env.SESSION_SECRET;
    if (!hash || !secret) {
      return reply.code(503).send({ error: "Login is not configured" });
    }
    const ok = await verifyPassword(parsed.data.password, hash);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid password" });
    }
    reply.setCookie(sessionCookie.name, createSessionToken(secret), {
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

  app.get("/api/session", async (request, reply) => {
    if (!isAuthenticated(ctx, request)) {
      return reply.code(401).send({ authenticated: false });
    }
    return { authenticated: true };
  });
}

export function isAuthenticated(ctx: AppContext, request: FastifyRequest): boolean {
  const secret = ctx.env.SESSION_SECRET;
  const token = request.cookies[sessionCookie.name];
  return Boolean(secret && token && readSessionToken(secret, token));
}

export async function requireSession(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!isAuthenticated(ctx, request)) {
    await reply.code(401).send({ error: "Authentication required" });
  }
}
