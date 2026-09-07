import type Database from "better-sqlite3";
import { campaignConfigSchema, type CampaignConfig } from "../../shared/schemas.js";
import { campaignBriefSchema, campaignStrategySchema, type CampaignBrief, type CampaignStrategy } from "../../shared/campaigns.js";
import type { PublicLead } from "../../shared/contracts.js";

export type ManagedCampaign = {
  config: CampaignConfig;
  brief: CampaignBrief;
  strategy: CampaignStrategy;
  createdAt: string;
  updatedAt: string;
};

export class CampaignStore {
  constructor(private readonly db: Database.Database) {}

  list(): ManagedCampaign[] {
    const rows = this.db.prepare("SELECT * FROM campaigns ORDER BY created_at, id").all() as Array<{
      config_json: string; brief_json: string; strategy_json: string; created_at: string; updated_at: string;
    }>;
    return rows.map(row => ({
      config: campaignConfigSchema.parse(JSON.parse(row.config_json)),
      brief: campaignBriefSchema.parse(JSON.parse(row.brief_json)),
      strategy: campaignStrategySchema.parse(JSON.parse(row.strategy_json)),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  get(id: string): ManagedCampaign | null {
    return this.list().find(item => item.config.id === id) ?? null;
  }

  save(campaign: ManagedCampaign, expectedVersion?: number): void {
    const { config, brief, strategy, createdAt, updatedAt } = campaign;
    if (expectedVersion === undefined) {
      this.db.prepare(`INSERT INTO campaigns
        (id, version, brief_json, strategy_json, config_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(config.id, config.version, JSON.stringify(brief), JSON.stringify(strategy), JSON.stringify(config), createdAt, updatedAt);
      return;
    }
    const result = this.db.prepare(`UPDATE campaigns SET version = ?, brief_json = ?, strategy_json = ?, config_json = ?, updated_at = ?
      WHERE id = ? AND version = ?`).run(config.version, JSON.stringify(brief), JSON.stringify(strategy), JSON.stringify(config), updatedAt, config.id, expectedVersion);
    if (result.changes !== 1) {
      throw new Error("Campaign changed while generating. Reload it before trying again.");
    }
  }

  includes(campaignId: string, lead: Pick<PublicLead, "leadId" | "campaignId">): boolean {
    return this.membership(campaignId)(lead);
  }

  membership(campaignId: string): (lead: Pick<PublicLead, "leadId" | "campaignId">) => boolean {
    const rows = this.db.prepare("SELECT lead_id, assigned FROM campaign_leads WHERE campaign_id = ?").all(campaignId) as Array<{ lead_id: string; assigned: number }>;
    const overrides = new Map(rows.map(row => [row.lead_id, row.assigned]));
    const tag = this.get(campaignId)?.brief.sheetCampaignValue;
    return lead => {
      const override = overrides.get(lead.leadId);
      if (override !== undefined) return override === 1;
      return lead.campaignId === campaignId || Boolean(tag && lead.campaignId === tag);
    };
  }

  assign(campaignId: string, leadIds: string[], assigned: boolean): void {
    const insert = this.db.prepare(`INSERT INTO campaign_leads (campaign_id, lead_id, assigned) VALUES (?, ?, ?)
      ON CONFLICT(campaign_id, lead_id) DO UPDATE SET assigned = excluded.assigned`);
    this.db.transaction(() => {
      for (const leadId of leadIds) insert.run(campaignId, leadId, Number(assigned));
    })();
  }
}

export function skippedLeadKey(campaignId: string | null, leadId: string): string {
  return JSON.stringify([campaignId, leadId]);
}
