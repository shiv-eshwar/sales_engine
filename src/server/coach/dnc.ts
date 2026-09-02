const PHRASES = [
  "do not contact",
  "don't contact",
  "do not call",
  "don't call me",
  "don't call us",
  "stop calling",
  "never call",
  "take me off",
  "remove me from"
];

export function detectsDoNotContact(text: string): boolean {
  const lower = text.toLowerCase();
  return PHRASES.some((phrase) => lower.includes(phrase));
}

export function isMeaningfulContactText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "[gap]") {
    return false;
  }
  const letters = trimmed.replace(/[^\p{L}\p{N}]+/gu, "");
  return letters.length >= 3;
}
