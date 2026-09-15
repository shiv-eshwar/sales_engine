export const CUSTOM_DIAL_CAMPAIGN_ID = "custom";

export function customDialLeadId(e164: string): string {
  return `custom:${e164}`;
}

export function isCustomDialCampaign(campaignId: string | null | undefined): boolean {
  return campaignId === CUSTOM_DIAL_CAMPAIGN_ID;
}

export function isCustomDialLeadId(leadId: string | null | undefined): boolean {
  return Boolean(leadId?.startsWith("custom:"));
}
