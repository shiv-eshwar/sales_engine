import type { PublicProposal, SheetDiagnostic } from "../shared/contracts";

export function waitingReviews(pending: PublicProposal | null): PublicProposal[] {
  if (!pending || pending.status === "processing") return [];
  return [pending];
}

export function notificationCount(pending: PublicProposal | null, diagnostics: SheetDiagnostic[]): number {
  return waitingReviews(pending).length + diagnostics.length;
}

export function reviewHref(sessionId: string): string {
  return `/calls/${encodeURIComponent(sessionId)}/review`;
}

export function reviewAlertTitle(item: PublicProposal): string {
  const who = item.contactName.trim() || item.leadId;
  if (item.status === "pending_retry") {
    return `CRM write failed for ${who}`;
  }
  return `Review waiting for ${who}`;
}
