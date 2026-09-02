import type { Env } from "../env.js";

export const OPERATOR_IDENTITY = "operator";

export function twilioVoiceConfigured(env: Env): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_API_KEY_SID &&
      env.TWILIO_API_KEY_SECRET &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_TWIML_APP_SID &&
      env.TWILIO_CALLER_ID
  );
}

export function publicUrl(env: Env, path: string): string {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function publicWsUrl(env: Env, path: string): string {
  return publicUrl(env, path).replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
}
