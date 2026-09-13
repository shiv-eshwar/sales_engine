import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CALL_REVIEW_WINDOW_FEATURES,
  callReviewPath,
  openCallReviewTab,
  resetOpenedCallReviewTabsForTests
} from "../../src/client/state/openCallReview.js";

describe("openCallReviewTab", () => {
  afterEach(() => {
    resetOpenedCallReviewTabsForTests();
    vi.unstubAllGlobals();
  });

  it("opens a same-origin review URL in a new tab once per session", () => {
    const open = vi.fn(() => ({ closed: false }) as Window);
    vi.stubGlobal("window", { open });
    expect(callReviewPath("s-1")).toBe("/calls/s-1/review");
    expect(openCallReviewTab("s-1")).not.toBeNull();
    expect(openCallReviewTab("s-1")).toBeNull();
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith("/calls/s-1/review", "_blank", CALL_REVIEW_WINDOW_FEATURES);
  });
});
