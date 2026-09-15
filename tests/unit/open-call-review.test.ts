import { describe, expect, it } from "vitest";
import { callReviewPath } from "../../src/client/state/openCallReview.js";

describe("callReviewPath", () => {
  it("returns the same-tab review URL for a session", () => {
    expect(callReviewPath("s-1")).toBe("/calls/s-1/review");
    expect(callReviewPath("id/with spaces")).toBe("/calls/id%2Fwith%20spaces/review");
  });
});
