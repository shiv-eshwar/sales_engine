import { describe, expect, it } from "vitest";
import { loadPlaybook } from "../../src/server/config/playbook.js";
import { computeTalkRatio } from "../../src/server/coach/talkRatio.js";
import type { PublicUtterance } from "../../src/server/transcript/utterances.js";

function row(
  speaker: "caller" | "contact",
  start: number,
  end: number,
  text = "hello"
): PublicUtterance {
  return {
    id: `${speaker}-${start}`,
    sessionId: "s",
    speaker,
    text,
    startedAtMs: start,
    endedAtMs: end,
    confidence: 1,
    isFinal: true,
    sequence: start
  };
}

describe("Talk ratio", () => {
  const playbook = loadPlaybook("./config/playbooks/cold-calling.yaml");

  it("is calculated from utterance timestamps, not the model", () => {
    const ratio = computeTalkRatio(
      [row("caller", 0, 800), row("contact", 800, 1000)],
      new Date(Date.now() - 70_000).toISOString(),
      playbook
    );
    expect(ratio.callerShare).toBeCloseTo(0.8);
    expect(ratio.contactShare).toBeCloseTo(0.2);
    expect(ratio.warn).toBe(true);
  });

  it("does not warn before the connected threshold", () => {
    const ratio = computeTalkRatio(
      [row("caller", 0, 800), row("contact", 800, 1000)],
      new Date().toISOString(),
      playbook
    );
    expect(ratio.warn).toBe(false);
  });
});
