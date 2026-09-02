import type { Env } from "../env.js";
import type { Speaker } from "../transcript/events.js";

function normalizeTrack(value: string): string {
  return value.trim().toLowerCase().replace(/_track$/, "");
}

/**
 * Default mapping is inbound → caller, outbound → contact.
 * Unconfirmed until a live smoke test; override with TWILIO_TRACK_CALLER / TWILIO_TRACK_CONTACT.
 */
export function speakerForTrack(track: string, env: Env): Speaker {
  const normalized = normalizeTrack(track);
  const caller = normalizeTrack(env.TWILIO_TRACK_CALLER);
  const contact = normalizeTrack(env.TWILIO_TRACK_CONTACT);
  if (normalized === contact) {
    return "contact";
  }
  if (normalized === caller) {
    return "caller";
  }
  return normalized === "outbound" ? "contact" : "caller";
}
