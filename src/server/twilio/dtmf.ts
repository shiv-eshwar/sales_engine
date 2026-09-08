import twilio from "twilio";
import type { Env } from "../env.js";

export const DTMF_DIGITS_RE = /^[0-9*#wW]+$/;
export const DTMF_MAX_DIGITS = 32;

export type DtmfSender = (callSid: string, digits: string) => Promise<void>;

export function buildPlayDigitsTwiml(digits: string): string {
  return `<Response><Play digits="${digits}"></Play></Response>`;
}

export function validateDtmfDigits(digits: unknown): digits is string {
  return (
    typeof digits === "string" &&
    digits.length >= 1 &&
    digits.length <= DTMF_MAX_DIGITS &&
    DTMF_DIGITS_RE.test(digits)
  );
}

export function createDtmfSender(env: Env): DtmfSender {
  return async (callSid: string, digits: string) => {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio is not configured");
    }
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    await client.calls(callSid).update({ twiml: buildPlayDigitsTwiml(digits) });
  };
}
