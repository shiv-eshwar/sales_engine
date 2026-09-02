import type Database from "better-sqlite3";
import type { CampaignConfig, PlaybookConfig, SheetsConfig } from "../shared/schemas.js";
import type { CoachEngine } from "./coach/engine.js";
import type { DeepgramLiveFactory } from "./deepgram/types.js";
import type { LlmClient } from "./llm/types.js";
import type { Env } from "./env.js";
import type { ReviewFinalizer } from "./review/finalize.js";
import { SheetAdapter } from "./sheets/adapter.js";
import type { LiveEventBus } from "./transcript/events.js";
import type { MediaHub } from "./twilio/mediaHub.js";
import type { StreamTokenStore } from "./twilio/streamTokens.js";

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
  streamTokens: StreamTokenStore;
  liveEvents: LiveEventBus;
  deepgramFactory: DeepgramLiveFactory;
  mediaHub: MediaHub;
  llmClient: LlmClient | null;
  coachEngine: CoachEngine;
  finalizer: ReviewFinalizer | null;
  shuttingDown: boolean;
};

export function createOperatorState(): OperatorState {
  return {
    skippedLeadIds: new Set(),
    selectedCampaignId: null
  };
}
