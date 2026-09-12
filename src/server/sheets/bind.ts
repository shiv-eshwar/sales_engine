import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { ReviewFinalizer } from "../review/finalize.js";
import type { AppContext } from "../context.js";
import type { SheetsConfig } from "../../shared/schemas.js";
import { resolveSheetsBackend } from "../env.js";
import { allowedCountriesFromEnv, createSheetStore } from "./createStore.js";
import { SheetAdapter } from "./adapter.js";
import { spreadsheetUrl } from "./id.js";
import type { SheetInfo } from "../../shared/contracts.js";

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

function persistPath(ctx: AppContext): string | null {
  if (ctx.env.NODE_ENV === "test") return null;
  const path = resolve(ctx.env.SHEETS_CONFIG_PATH);
  if (path.endsWith("sheets.example.yaml")) return null;
  return path;
}

export function persistSheetsConfig(ctx: AppContext, config: SheetsConfig): void {
  const path = persistPath(ctx);
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringify(config), { encoding: "utf8", mode: 0o600 });
}

export async function attachSheetsConfig(ctx: AppContext, config: SheetsConfig): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const store = createSheetStore(ctx.env, config);
  if (!store) {
    return { ok: false, message: "Google Sheets credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64." };
  }
  const adapter = new SheetAdapter(store, config, allowedCountriesFromEnv(ctx.env), ctx.db);
  const preflight = await adapter.preflight();
  if (!preflight.ok) {
    return { ok: false, message: preflight.errors.join(" ") };
  }
  ctx.sheetsConfig = config;
  ctx.sheetsConfigError = null;
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
  persistSheetsConfig(ctx, config);
  return { ok: true, message: ctx.sheetMessage };
}
