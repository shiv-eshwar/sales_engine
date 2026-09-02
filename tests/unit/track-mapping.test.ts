import { describe, expect, it } from "vitest";
import { speakerForTrack } from "../../src/server/deepgram/mapping.js";
import type { Env } from "../../src/server/env.js";

const env = {
  TWILIO_TRACK_CALLER: "inbound",
  TWILIO_TRACK_CONTACT: "outbound"
} as Env;

describe("Twilio track to speaker mapping", () => {
  it("defaults inbound to caller and outbound to contact", () => {
    expect(speakerForTrack("inbound", env)).toBe("caller");
    expect(speakerForTrack("inbound_track", env)).toBe("caller");
    expect(speakerForTrack("outbound", env)).toBe("contact");
    expect(speakerForTrack("outbound_track", env)).toBe("contact");
  });
});
