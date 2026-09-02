import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { campaignConfigSchema, type CampaignConfig } from "../../shared/schemas.js";

export function loadCampaigns(dir: string): CampaignConfig[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No campaign YAML files found in ${dir}`);
  }

  const campaigns = files.map((file) => {
    const parsed: unknown = parse(readFileSync(join(dir, file), "utf8"));
    try {
      return campaignConfigSchema.parse(parsed);
    } catch (error) {
      throw new Error(`Invalid campaign file ${file}: ${String(error)}`);
    }
  });

  const typeOrder: Record<string, number> = { sales: 0, research: 1, networking: 2 };
  campaigns.sort((a, b) => {
    const left = typeOrder[a.type] ?? 9;
    const right = typeOrder[b.type] ?? 9;
    if (left !== right) {
      return left - right;
    }
    return a.name.localeCompare(b.name);
  });

  const ids = new Set<string>();
  for (const campaign of campaigns) {
    if (ids.has(campaign.id)) {
      throw new Error(`Duplicate campaign id "${campaign.id}"`);
    }
    ids.add(campaign.id);
  }

  return campaigns;
}
