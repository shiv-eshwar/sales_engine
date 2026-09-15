import { reviewHref } from "../notifications";

/** Same-tab review URL. ReviewPage polls until the proposal exists. */
export function callReviewPath(sessionId: string): string {
  return reviewHref(sessionId);
}
