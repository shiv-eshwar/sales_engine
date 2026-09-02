import twilio from "twilio";
import type { AppContext } from "../context.js";
import { publicUrl, publicWsUrl } from "./config.js";

export function outboundDialTwiml(ctx: AppContext, sessionId: string, e164: string): string {
  const env = ctx.env;
  const streamToken = ctx.streamTokens.issue(sessionId);
  const response = new twilio.twiml.VoiceResponse();
  const start = response.start();
  const stream = start.stream({
    url: publicWsUrl(env, "/twilio/media"),
    track: "both_tracks"
  });
  stream.parameter({ name: "streamToken", value: streamToken });
  stream.parameter({ name: "sessionId", value: sessionId });

  const dial = response.dial({
    callerId: env.TWILIO_CALLER_ID,
    answerOnBridge: true,
    record: "record-from-answer-dual",
    recordingStatusCallback: publicUrl(env, "/twilio/recording/status"),
    recordingStatusCallbackEvent: ["completed", "absent"],
    recordingStatusCallbackMethod: "POST",
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
