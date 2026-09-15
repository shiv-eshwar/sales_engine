import "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../context.js";
import { cookieSecure } from "../env.js";
import { credentialsSchema } from "../../shared/schemas.js";
import { authenticateUser, createUser, DuplicateEmailError, findUserById } from "./users.js";
import { createSessionToken, readSessionToken, sessionCookie } from "./session.js";

const INVALID_CREDENTIALS = "Invalid email or password";

function sessionSecret(ctx: AppContext): string | null {
  const secret = ctx.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return null;
  }
  return secret;
}

function cookieOptions(ctx: AppContext) {
  return {
    path: "/",
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: cookieSecure(ctx.env),
    maxAge: sessionCookie.maxAge
  };
}

export function getSessionUser(ctx: AppContext, request: FastifyRequest): { id: string; email: string } | null {
  const secret = sessionSecret(ctx);
  if (!secret) {
    return null;
  }
  const token = request.cookies[sessionCookie.name];
  if (!token) {
    return null;
  }
  const userId = readSessionToken(secret, token);
  if (!userId) {
    return null;
  }
  const user = findUserById(ctx.db, userId);
  if (!user) {
    return null;
  }
  return { id: user.id, email: user.email };
}

function setSessionCookie(ctx: AppContext, reply: FastifyReply, userId: string): boolean {
  const secret = sessionSecret(ctx);
  if (!secret) {
    return false;
  }
  reply.setCookie(sessionCookie.name, createSessionToken(secret, userId), cookieOptions(ctx));
  return true;
}

export async function registerAuth(app: import("fastify").FastifyInstance, ctx: AppContext): Promise<void> {
  app.post("/api/signup", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Enter a valid email and a password of at least 8 characters." });
    }
    try {
      const user = await createUser(ctx.db, parsed.data.email, parsed.data.password);
      if (!setSessionCookie(ctx, reply, user.id)) {
        return reply.code(503).send({ error: "Set SESSION_SECRET (at least 16 characters) to enable sign in." });
      }
      return { ok: true, email: user.email };
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post("/api/login", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: INVALID_CREDENTIALS });
    }
    const user = await authenticateUser(ctx.db, parsed.data.email, parsed.data.password);
    if (!user) {
      return reply.code(401).send({ error: INVALID_CREDENTIALS });
    }
    if (!setSessionCookie(ctx, reply, user.id)) {
      return reply.code(503).send({ error: "Set SESSION_SECRET (at least 16 characters) to enable sign in." });
    }
    return { ok: true, email: user.email };
  });

  app.post("/api/logout", async (_request, reply) => {
    reply.clearCookie(sessionCookie.name, cookieOptions(ctx));
    return { ok: true };
  });

  app.get("/api/session", async (request) => {
    const user = getSessionUser(ctx, request);
    if (!user) {
      return { authenticated: false, email: null };
    }
    return { authenticated: true, email: user.email };
  });
}

export function isAuthenticated(ctx: AppContext, request: FastifyRequest): boolean {
  return getSessionUser(ctx, request) !== null;
}

export async function requireSession(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!sessionSecret(ctx)) {
    return reply.code(503).send({ error: "Set SESSION_SECRET (at least 16 characters) to enable sign in." });
  }
  if (!getSessionUser(ctx, request)) {
    return reply.code(401).send({ error: "Sign in required" });
  }
}
