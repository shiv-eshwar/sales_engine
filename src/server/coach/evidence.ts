import type { PublicUtterance } from "../transcript/utterances.js";
import type { LeadSnapshot } from "../calls/ledger.js";

export function evidenceInContext(
  evidence: string | null,
  utterances: PublicUtterance[],
  snapshot: LeadSnapshot
): boolean {
  if (!evidence || !evidence.trim()) {
    return false;
  }
  const needle = evidence.trim().toLowerCase();
  const haystacks = [
    ...utterances.filter((row) => row.text !== "[gap]").map((row) => row.text),
    snapshot.fullName,
    snapshot.company,
    snapshot.role,
    snapshot.phone,
    snapshot.phoneE164,
    snapshot.leadId
  ];
  return haystacks.some((text) => text.toLowerCase().includes(needle));
}
