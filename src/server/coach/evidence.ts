import type { PublicUtterance } from "../transcript/utterances.js";
import type { LeadSnapshot } from "../calls/ledger.js";

function normalizeEvidenceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''ʼ`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuotedSegments(evidence: string): string[] {
  const segments: string[] = [];
  const pattern = /[""“”]([^""“”]{3,})[""“”]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(evidence)) !== null) {
    const segment = (match[1] ?? "").trim();
    if (segment.length >= 3) {
      segments.push(segment);
    }
  }
  return segments;
}

function shingleMatches(needleWords: string[], haystacks: string[], size = 4): boolean {
  if (needleWords.length < size) {
    return false;
  }
  for (let i = 0; i + size <= needleWords.length; i += 1) {
    const phrase = needleWords.slice(i, i + size).join(" ");
    if (phrase.length < 10) {
      continue;
    }
    if (haystacks.some((haystack) => haystack.includes(phrase))) {
      return true;
    }
  }
  return false;
}

export function evidenceInContext(
  evidence: string | null,
  utterances: PublicUtterance[],
  snapshot: LeadSnapshot
): boolean {
  if (!evidence || !evidence.trim()) {
    return false;
  }
  const haystacks = [
    ...utterances.filter((row) => row.text !== "[gap]").map((row) => row.text),
    snapshot.fullName,
    snapshot.company,
    snapshot.role,
    snapshot.phone,
    snapshot.phoneE164,
    snapshot.leadId
  ];
  // Fast path: exact case-insensitive substring (previous behavior).
  const needle = evidence.trim().toLowerCase();
  if (haystacks.some((text) => text.toLowerCase().includes(needle))) {
    return true;
  }
  // Tolerant path: punctuation-insensitive comparison so paraphrased evidence
  // that embeds a verbatim quote is not rejected (e.g. extra commas, casing,
  // or surrounding explanation added by the extraction model).
  const normalizedNeedle = normalizeEvidenceText(evidence);
  if (!normalizedNeedle) {
    return false;
  }
  const normalizedHaystacks = haystacks
    .map((text) => normalizeEvidenceText(text))
    .filter((text) => text.length > 0);
  if (normalizedHaystacks.some((haystack) => haystack.includes(normalizedNeedle))) {
    return true;
  }
  // Quoted-span path: accept when any explicitly quoted span from the evidence
  // appears verbatim in the transcript (the common LLM pattern:
  // explanation + "quoted contact words").
  for (const segment of extractQuotedSegments(evidence)) {
    const normalizedSegment = normalizeEvidenceText(segment);
    if (normalizedSegment.length < 4) {
      continue;
    }
    if (normalizedHaystacks.some((haystack) => haystack.includes(normalizedSegment))) {
      return true;
    }
  }
  // Shingle path: accept when a distinctive 4-word run from the evidence
  // appears in the transcript even without quote marks.
  return shingleMatches(normalizedNeedle.split(" "), normalizedHaystacks, 4);
}
