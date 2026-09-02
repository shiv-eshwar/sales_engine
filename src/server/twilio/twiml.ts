import twilio from "twilio";
import type { Env } from "../env.js";
import { publicUrl } from "./config.js";

export function outboundDialTwiml(env: Env, e164: string): string {
  const response = new twilio.twiml.VoiceResponse();
  const dial = response.dial({
    callerId: env.TWILIO_CALLER_ID,
    answerOnBridge: true,
    action: publicUrl(env, "/twilio/voice/status"),
    method: "POST"
  });
  dial.number(
    {
      statusCallback: publicUrl(env, "/twilio/voice/number-status"),
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST"
    },
    e164
  );
  return response.toString();
}

export function rejectTwiml(message: string): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(message);
  response.hangup();
  return response.toString();
}
