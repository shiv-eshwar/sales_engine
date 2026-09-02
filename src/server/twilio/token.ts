import twilio from "twilio";
import type { Env } from "../env.js";
import { OPERATOR_IDENTITY } from "./config.js";

const TOKEN_TTL_SECONDS = 60 * 5;

export function createVoiceAccessToken(env: Env): string {
  if (
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_API_KEY_SID ||
    !env.TWILIO_API_KEY_SECRET ||
    !env.TWILIO_TWIML_APP_SID
  ) {
    throw new Error("Twilio Voice is not configured");
  }
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(env.TWILIO_ACCOUNT_SID, env.TWILIO_API_KEY_SID, env.TWILIO_API_KEY_SECRET, {
    identity: OPERATOR_IDENTITY,
    ttl: TOKEN_TTL_SECONDS
  });
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: env.TWILIO_TWIML_APP_SID,
      incomingAllow: false
    })
  );
  return token.toJwt();
}
