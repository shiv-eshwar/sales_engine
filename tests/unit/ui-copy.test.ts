import { describe, expect, it } from "vitest";
import {
  diagnosticCopy,
  EMPTY_COPY,
  formatUtteranceText,
  outcomeLabel,
  qualificationLabel
} from "../../src/client/copy.js";

describe("caller-facing copy", () => {
  it("uses human labels for outcomes and qualification", () => {
    expect(outcomeLabel("permission_to_follow_up")).toBe("Follow-up allowed");
    expect(qualificationLabel("unknown")).toBe("Unknown");
  });

  it("turns transcript gaps into a time range", () => {
    expect(formatUtteranceText("[gap]", 12_000, 18_000)).toBe("Audio missed 00:12–00:18");
    expect(formatUtteranceText("hello", 0, 1_000)).toBe("hello");
  });

  it("humanizes sheet diagnostics", () => {
    expect(diagnosticCopy({ code: "blank_lead_id", message: "x", rowNumber: 6 })).toBe(
      "Row 6 has no Lead ID — skipped."
    );
  });

  it("keeps empty-state copy operator-facing", () => {
    expect(EMPTY_COPY.campaign.title).toBe("Create a campaign");
    expect(EMPTY_COPY.queue.title).toBe("No one is ready to call");
  });
});
