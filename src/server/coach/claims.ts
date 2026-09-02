import type { CampaignConfig } from "../../shared/schemas.js";

const INVENTION =
  /\d+%|\$\d[\d,]*|\bguaranteed\b|\bcase study\b|\bincreased revenue\b|\bcustomer \w+ (saw|achieved|saved)\b/i;

export function cueClaimsApproved(cue: string, campaign: CampaignConfig): boolean {
  const text = cue.trim();
  if (!text) {
    return true;
  }
  const lower = text.toLowerCase();
  if (campaign.approved_claims.some((claim) => lower.includes(claim.text.toLowerCase()))) {
    return true;
  }
  return !INVENTION.test(text);
}
