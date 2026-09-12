import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/routes.js";
import type { AppContext } from "../context.js";
import { resolveSheetsBackend } from "../env.js";
import { createGoogleSpreadsheet, inspectGoogleSpreadsheet, writeGoogleHeaderRow } from "../sheets/admin.js";
import {
  activateCampaignSheet,
  assertSpreadsheetAvailable,
  attachSheetsConfig,
  campaignSheetsConfig,
  sheetInfoForConfig,
  SheetBindingError
} from "../sheets/bind.js";
import { parseSpreadsheetId } from "../sheets/id.js";
import { headerRow } from "../sheets/template.js";
import { preflightHeaders } from "../sheets/preflight.js";
import type { SheetsConfig } from "../../shared/schemas.js";

function googleJson(ctx: AppContext): string | null {
  const json = ctx.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  return json ? json : null;
}

const bindTargetSchema = z.object({
  requestId: z.uuid().optional(),
  campaignId: z.string().trim().min(1).max(200).optional()
}).refine((value) => Boolean(value.requestId || value.campaignId), {
  message: "requestId"
});

function parseBindTarget(body: unknown): { requestId?: string; campaignId?: string } | null {
  const parsed = bindTargetSchema.safeParse(body ?? {});
  return parsed.success ? parsed.data : null;
}

async function commitBinding(
  ctx: AppContext,
  config: SheetsConfig,
  target: { requestId?: string; campaignId?: string }
): Promise<{ sheet: ReturnType<typeof sheetInfoForConfig>; spreadsheetId: string; sheetName: string }> {
  assertSpreadsheetAvailable(ctx, config.spreadsheet_id, target.requestId);
  const attached = await attachSheetsConfig(ctx, config);
  if (!attached.ok) {
    throw new SheetBindingError(attached.message, 502);
  }
  if (target.campaignId) {
    const campaign = ctx.campaignStore.get(target.campaignId);
    if (!campaign) throw new SheetBindingError("Editable campaign not found.", 404);
    if (campaign.spreadsheetId) {
      throw new SheetBindingError("That campaign already has a Sheet. Campaigns cannot share or replace a spreadsheet.", 409);
    }
    ctx.campaignStore.setSheet(target.campaignId, config.spreadsheet_id, config.sheet_name);
    if (ctx.operator.selectedCampaignId === target.campaignId) {
      await activateCampaignSheet(ctx, target.campaignId);
    }
  } else if (target.requestId) {
    ctx.pendingSheets.set(target.requestId, config);
    // Keep the selected campaign's live adapter; pending is only for the in-progress create.
    if (ctx.operator.selectedCampaignId) {
      await activateCampaignSheet(ctx, ctx.operator.selectedCampaignId);
    } else {
      ctx.adapter = null;
      ctx.sheetsConfig = null;
      ctx.finalizer = null;
    }
  }
  return {
    spreadsheetId: config.spreadsheet_id,
    sheetName: config.sheet_name,
    sheet: sheetInfoForConfig(ctx, config, {
      status: "ok",
      message: "Sheet connected for this campaign",
      diagnostics: []
    })
  };
}

function newMemorySpreadsheetId(): string {
  return `memory-${randomUUID()}`;
}

function parseMemorySpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  return parseSpreadsheetId(trimmed) ?? (/^[a-zA-Z0-9:_-]{8,80}$/.test(trimmed) ? trimmed : null);
}

export async function registerSheets(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };

  app.post("/api/sheets/create", { preHandler: auth }, async (request, reply) => {
    const parsed = z.object({
      title: z.string().trim().min(1).max(160).default("Sales Engine Leads"),
      shareEmail: z.string().trim().max(320).optional(),
      requestId: z.uuid().optional(),
      campaignId: z.string().trim().min(1).max(200).optional()
    }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Provide a Sheet title." });
    const target = parseBindTarget(parsed.data);
    if (!target) return reply.code(400).send({ error: "Connect this Sheet to a new or existing campaign." });
    const shareEmail = parsed.data.shareEmail?.trim() || undefined;
    if (shareEmail && !z.string().email().safeParse(shareEmail).success) {
      return reply.code(400).send({ error: "Share with a valid Google email, or leave it blank." });
    }
    const backend = resolveSheetsBackend(ctx.env);
    try {
      if (backend === "memory") {
        const spreadsheetId = newMemorySpreadsheetId();
        const config = campaignSheetsConfig(ctx, spreadsheetId, ctx.sheetsTemplate?.sheet_name ?? "Leads");
        const bound = await commitBinding(ctx, config, target);
        return {
          spreadsheetId: bound.spreadsheetId,
          url: bound.sheet.url,
          title: parsed.data.title,
          sheetName: bound.sheetName,
          created: true,
          sheet: bound.sheet
        };
      }
      if (backend !== "google") {
        return reply.code(409).send({ error: "Creating a Google Sheet needs SHEETS_BACKEND=google." });
      }
      const json = googleJson(ctx);
      if (!json) return reply.code(503).send({ error: "Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 before creating a Sheet." });
      const created = await createGoogleSpreadsheet(json, parsed.data.title, shareEmail);
      const config = campaignSheetsConfig(ctx, created.spreadsheetId, created.sheetName);
      const bound = await commitBinding(ctx, config, target);
      return {
        spreadsheetId: created.spreadsheetId,
        url: created.url,
        title: created.title,
        sheetName: created.sheetName,
        created: true,
        sheet: bound.sheet
      };
    } catch (error) {
      if (error instanceof SheetBindingError) return reply.code(error.http).send({ error: error.message });
      const message = error instanceof Error ? error.message : "Could not create the Google Sheet.";
      return reply.code(502).send({ error: message });
    }
  });

  app.post("/api/sheets/link", { preHandler: auth }, async (request, reply) => {
    const parsed = z.object({
      spreadsheet: z.string().trim().min(1).max(2000),
      requestId: z.uuid().optional(),
      campaignId: z.string().trim().min(1).max(200).optional()
    }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Paste a Google Sheet URL or ID." });
    const target = parseBindTarget(parsed.data);
    if (!target) return reply.code(400).send({ error: "Connect this Sheet to a new or existing campaign." });
    const backend = resolveSheetsBackend(ctx.env);
    try {
      if (backend === "memory") {
        const spreadsheetId = parseMemorySpreadsheetId(parsed.data.spreadsheet);
        if (!spreadsheetId) return reply.code(400).send({ error: "That does not look like a spreadsheet ID." });
        const config = campaignSheetsConfig(ctx, spreadsheetId, ctx.sheetsTemplate?.sheet_name ?? "Leads");
        const bound = await commitBinding(ctx, config, target);
        return {
          spreadsheetId,
          url: bound.sheet.url,
          sheetName: bound.sheetName,
          created: false,
          initializedHeaders: false,
          sheet: bound.sheet
        };
      }
      if (backend !== "google") {
        return reply.code(409).send({ error: "Linking a Google Sheet needs SHEETS_BACKEND=google." });
      }
      const json = googleJson(ctx);
      if (!json) return reply.code(503).send({ error: "Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 before linking a Sheet." });
      const spreadsheetId = parseSpreadsheetId(parsed.data.spreadsheet);
      if (!spreadsheetId) return reply.code(400).send({ error: "That does not look like a Google Sheet URL or ID." });
      assertSpreadsheetAvailable(ctx, spreadsheetId, target.requestId);
      const draft = campaignSheetsConfig(ctx, spreadsheetId);
      const inspected = await inspectGoogleSpreadsheet(json, spreadsheetId, draft.sheet_name);
      const config = campaignSheetsConfig(ctx, spreadsheetId, inspected.sheetName);
      let initializedHeaders = false;
      const empty = inspected.headers.every((header) => header === "");
      if (empty) {
        await writeGoogleHeaderRow(json, spreadsheetId, config.sheet_name, headerRow(config));
        initializedHeaders = true;
      } else {
        const errors = preflightHeaders(config, inspected.headers);
        if (errors.length > 0) {
          return reply.code(409).send({
            error: errors.map((item) => item.message).join(" ")
          });
        }
      }
      const bound = await commitBinding(ctx, config, target);
      return {
        spreadsheetId,
        url: bound.sheet.url,
        title: inspected.title,
        sheetName: config.sheet_name,
        created: false,
        initializedHeaders,
        sheet: bound.sheet
      };
    } catch (error) {
      if (error instanceof SheetBindingError) return reply.code(error.http).send({ error: error.message });
      const message = error instanceof Error ? error.message : "Could not open that Google Sheet.";
      return reply.code(502).send({ error: message });
    }
  });
}
