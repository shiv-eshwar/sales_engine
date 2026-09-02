import type Database from "better-sqlite3";
import type { CampaignConfig, PlaybookConfig, SheetsConfig } from "../shared/schemas.js";
import type { Env } from "./env.js";
import { SheetAdapter } from "./sheets/adapter.js";

export type OperatorState = {
  skippedLeadIds: Set<string>;
  selectedCampaignId: string | null;
};

export type AppContext = {
  env: Env;
  db: Database.Database;
  campaigns: CampaignConfig[];
  playbook: PlaybookConfig | null;
  sheetsConfig: SheetsConfig | null;
  sheetsConfigError: string | null;
  adapter: SheetAdapter | null;
  sheetMessage: string;
  operator: OperatorState;
};

export function createOperatorState(): OperatorState {
  return {
    skippedLeadIds: new Set(),
    selectedCampaignId: null
  };
}
