import { reviewHref } from "../notifications";

/**
 * Post-call review always opens in a new tab so Home / lead detail stay put.
 *
 * Popup blockers: call `openCallReviewTab` from a **user gesture** (Hang Up
 * `onPress`), not after `await finalizeCall`. The review URL is known from the
 * session id, so we do not wait for the network. ReviewPage polls until the
 * proposal exists.
 *
 * `noopener,noreferrer` is required, which means we cannot assign
 * `tab.location` later. Do not open `about:blank` with these features.
 *
 * Remote hangup (no click) still calls this from `openReview`; the browser
 * may block that popup. Hang Up is the reliable path.
 */
const opened = new Set<string>();

export const CALL_REVIEW_WINDOW_FEATURES = "noopener,noreferrer";

export function callReviewPath(sessionId: string): string {
  return reviewHref(sessionId);
}

export function openCallReviewTab(sessionId: string): Window | null {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return null;
  }
  if (opened.has(sessionId)) {
    return null;
  }
  opened.add(sessionId);
  return window.open(callReviewPath(sessionId), "_blank", CALL_REVIEW_WINDOW_FEATURES);
}

export function resetOpenedCallReviewTabsForTests(): void {
  opened.clear();
}
