import { ReviewFinalizer } from "../review/finalize.js";
import type { AppContext } from "../context.js";
import type { SheetsConfig } from "../../shared/schemas.js";
import { resolveSheetsBackend } from "../env.js";
import { allowedCountriesFromEnv, createSheetStore } from "./createStore.js";
import { SheetAdapter } from "./adapter.js";
import { spreadsheetUrl } from "./id.js";
import type { SheetInfo } from "../../shared/contracts.js";
import { sheetsConfigForSpreadsheet } from "./template.js";

export class SheetBindingError extends Error {
  constructor(
    message: string,
    readonly http = 409
  ) {
    super(message);
    this.name = "SheetBindingError";
  }
}

export function publicSheetBinding(ctx: AppContext): Pick<SheetInfo, "backend" | "spreadsheetId" | "sheetName" | "url" | "manageable"> {
  const backend = resolveSheetsBackend(ctx.env);
  const spreadsheetId = ctx.sheetsConfig?.spreadsheet_id ?? null;
  return {
    backend,
    spreadsheetId,
    sheetName: ctx.sheetsConfig?.sheet_name ?? null,
    url: spreadsheetId && backend === "google" ? spreadsheetUrl(spreadsheetId) : null,
    manageable: Boolean(ctx.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim())
  };
}

export function withSheetBinding(ctx: AppContext, sheet: Omit<SheetInfo, "backend" | "spreadsheetId" | "sheetName" | "url" | "manageable">): SheetInfo {
  return { ...sheet, ...publicSheetBinding(ctx) };
}

export function sheetInfoForConfig(
  ctx: AppContext,
  config: SheetsConfig,
  sheet: Omit<SheetInfo, "backend" | "spreadsheetId" | "sheetName" | "url" | "manageable">
): SheetInfo {
  const backend = resolveSheetsBackend(ctx.env);
  return {
    ...sheet,
    backend,
    spreadsheetId: config.spreadsheet_id,
    sheetName: config.sheet_name,
    url: backend === "google" ? spreadsheetUrl(config.spreadsheet_id) : null,
    manageable: Boolean(ctx.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim())
  };
}

export function campaignSheetsConfig(ctx: AppContext, spreadsheetId: string, sheetName?: string | null): SheetsConfig {
  return sheetsConfigForSpreadsheet(ctx.sheetsTemplate, spreadsheetId, sheetName ?? undefined);
}

export function resolveCampaignSheetsConfig(ctx: AppContext, campaignId: string | null): SheetsConfig | null {
  if (!campaignId) return null;
  const managed = ctx.campaignStore.get(campaignId);
  if (managed?.spreadsheetId) {
    return campaignSheetsConfig(ctx, managed.spreadsheetId, managed.sheetName);
  }
  const fileId = ctx.fileSheetIds.get(campaignId);
  if (fileId) {
    return campaignSheetsConfig(ctx, fileId, ctx.sheetsTemplate?.sheet_name);
  }
  return null;
}

export function assertSpreadsheetAvailable(ctx: AppContext, spreadsheetId: string, exceptRequestId?: string): void {
  const owned = ctx.campaignStore.findBySpreadsheetId(spreadsheetId);
  if (owned) {
    throw new SheetBindingError("That Sheet is already attached to another campaign. Each campaign needs its own spreadsheet.");
  }
  for (const id of ctx.fileSheetIds.values()) {
    if (id === spreadsheetId) {
      throw new SheetBindingError("That Sheet is already attached to another campaign. Each campaign needs its own spreadsheet.");
    }
  }
  for (const [requestId, pending] of ctx.pendingSheets) {
    if (pending.spreadsheet_id !== spreadsheetId) continue;
    if (exceptRequestId && requestId === exceptRequestId) continue;
    ctx.pendingSheets.delete(requestId);
  }
}

export function peekPendingSheet(ctx: AppContext, requestId: string): SheetsConfig {
  const pending = ctx.pendingSheets.get(requestId);
  if (!pending) {
    throw new SheetBindingError("Connect a unique leads Sheet before creating this campaign.", 400);
  }
  return pending;
}

export function takePendingSheet(ctx: AppContext, requestId: string): SheetsConfig {
  const pending = peekPendingSheet(ctx, requestId);
  ctx.pendingSheets.delete(requestId);
  return pending;
}

export function bindFileCampaignSheets(ctx: AppContext): void {
  const backend = resolveSheetsBackend(ctx.env);
  for (const campaign of ctx.campaigns) {
    if (ctx.campaignStore.get(campaign.id)) continue;
    if (backend === "memory") {
      ctx.fileSheetIds.set(campaign.id, `memory:${campaign.id}`);
      continue;
    }
    if (backend === "google" && ctx.sheetsTemplate && ctx.fileSheetIds.size === 0) {
      ctx.fileSheetIds.set(campaign.id, ctx.sheetsTemplate.spreadsheet_id);
    }
  }
}

export function backfillCampaignSheets(ctx: AppContext): void {
  const templateId = ctx.sheetsTemplate?.spreadsheet_id;
  if (!templateId) return;
  try {
    assertSpreadsheetAvailable(ctx, templateId);
  } catch {
    return;
  }
  const unbound = ctx.campaignStore.list().filter(item => !item.spreadsheetId);
  const first = unbound[0];
  if (!first) return;
  ctx.campaignStore.setSheet(first.config.id, templateId, ctx.sheetsTemplate?.sheet_name ?? "Leads");
}

export async function attachSheetsConfig(ctx: AppContext, config: SheetsConfig): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const store = createSheetStore(ctx.env, config, ctx.memorySheets);
  if (!store) {
    return { ok: false, message: "Google Sheets credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64." };
  }
  const adapter = new SheetAdapter(store, config, allowedCountriesFromEnv(ctx.env), ctx.db);
  const preflight = await adapter.preflight();
  if (!preflight.ok) {
    return { ok: false, message: preflight.errors.join(" ") };
  }
  ctx.sheetsConfig = config;
  ctx.adapter = adapter;
  ctx.sheetMessage = `Sheet ready (${store.kind})`;
  ctx.finalizer = new ReviewFinalizer({
    db: ctx.db,
    campaigns: ctx.campaigns,
    playbook: ctx.playbook,
    sheetsConfig: config,
    adapter,
    llm: ctx.llmClient,
    coachEngine: ctx.coachEngine,
    mediaHub: ctx.mediaHub,
    extractionTimeoutMs: ctx.env.AI_GENERATION_TIMEOUT_MS
  });
  return { ok: true, message: ctx.sheetMessage };
}

export async function activateCampaignSheet(ctx: AppContext, campaignId: string | null): Promise<void> {
  const config = resolveCampaignSheetsConfig(ctx, campaignId);
  if (!config) {
    ctx.adapter = null;
    ctx.sheetsConfig = null;
    ctx.finalizer = null;
    ctx.sheetMessage = campaignId
      ? "This campaign has no leads Sheet. Connect a unique spreadsheet."
      : "Connect a unique leads Sheet when you create a campaign.";
    return;
  }
  if (ctx.sheetsConfig?.spreadsheet_id === config.spreadsheet_id && ctx.adapter) {
    return;
  }
  const attached = await attachSheetsConfig(ctx, config);
  if (attached.ok) return;
  ctx.adapter = null;
  ctx.sheetsConfig = config;
  ctx.finalizer = null;
  ctx.sheetMessage = attached.message;
}
