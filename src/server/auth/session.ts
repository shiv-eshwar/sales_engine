import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "operator_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  v: 1;
  exp: number;
};

function encode(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function createSessionToken(secret: string, now = Date.now()): string {
  const payload: SessionPayload = { v: 1, exp: now + MAX_AGE_SECONDS * 1000 };
  const body = encode(payload);
  return `${body}.${sign(secret, body)}`;
}

export function readSessionToken(secret: string, token: string, now = Date.now()): boolean {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return false;
  }
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!safeEqual(sign(secret, body), mac)) {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    return payload.v === 1 && payload.exp > now;
  } catch {
    return false;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE_SECONDS
};
