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
  spreadsheetId: string | null;
  sheetName: string | null;
};

type CampaignRow = {
  config_json: string;
  brief_json: string;
  strategy_json: string;
  created_at: string;
  updated_at: string;
  spreadsheet_id: string | null;
  sheet_name: string | null;
};

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
}

export class CampaignStore {
  constructor(private readonly db: Database.Database) {}

  list(): ManagedCampaign[] {
    const rows = this.db.prepare("SELECT * FROM campaigns ORDER BY created_at, id").all() as CampaignRow[];
    return rows.map(row => ({
      config: campaignConfigSchema.parse(JSON.parse(row.config_json)),
      brief: campaignBriefSchema.parse(JSON.parse(row.brief_json)),
      strategy: campaignStrategySchema.parse(JSON.parse(row.strategy_json)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      spreadsheetId: row.spreadsheet_id,
      sheetName: row.sheet_name
    }));
  }

  get(id: string): ManagedCampaign | null {
    return this.list().find(item => item.config.id === id) ?? null;
  }

  findBySpreadsheetId(spreadsheetId: string): ManagedCampaign | null {
    return this.list().find(item => item.spreadsheetId === spreadsheetId) ?? null;
  }

  save(campaign: ManagedCampaign, expectedVersion?: number): void {
    const { config, brief, strategy, createdAt, updatedAt, spreadsheetId, sheetName } = campaign;
    try {
      if (expectedVersion === undefined) {
        this.db.prepare(`INSERT INTO campaigns
          (id, version, brief_json, strategy_json, config_json, created_at, updated_at, spreadsheet_id, sheet_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(config.id, config.version, JSON.stringify(brief), JSON.stringify(strategy), JSON.stringify(config), createdAt, updatedAt, spreadsheetId, sheetName);
        return;
      }
      const result = this.db.prepare(`UPDATE campaigns SET version = ?, brief_json = ?, strategy_json = ?, config_json = ?, updated_at = ?, spreadsheet_id = ?, sheet_name = ?
        WHERE id = ? AND version = ?`).run(
        config.version,
        JSON.stringify(brief),
        JSON.stringify(strategy),
        JSON.stringify(config),
        updatedAt,
        spreadsheetId,
        sheetName,
        config.id,
        expectedVersion
      );
      if (result.changes !== 1) {
        throw new Error("Campaign changed while generating. Reload it before trying again.");
      }
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new Error("That Sheet is already attached to another campaign. Each campaign needs its own spreadsheet.");
      }
      throw error;
    }
  }

  setSheet(campaignId: string, spreadsheetId: string, sheetName: string): void {
    try {
      const result = this.db.prepare(
        `UPDATE campaigns SET spreadsheet_id = ?, sheet_name = ?, updated_at = ? WHERE id = ? AND spreadsheet_id IS NULL`
      ).run(spreadsheetId, sheetName, new Date().toISOString(), campaignId);
      if (result.changes !== 1) {
        throw new Error("That campaign already has a Sheet, or it could not be updated.");
      }
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new Error("That Sheet is already attached to another campaign. Each campaign needs its own spreadsheet.");
      }
      throw error;
    }
  }

  includes(_campaignId: string, _lead: Pick<PublicLead, "leadId" | "campaignId">): boolean {
    return true;
  }

  membership(_campaignId: string): (lead: Pick<PublicLead, "leadId" | "campaignId">) => boolean {
    return () => true;
  }
}

export function skippedLeadKey(campaignId: string | null, leadId: string): string {
  return JSON.stringify([campaignId, leadId]);
}
