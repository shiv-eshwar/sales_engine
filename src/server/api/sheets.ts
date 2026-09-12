import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/routes.js";
import type { AppContext } from "../context.js";
import { resolveSheetsBackend } from "../env.js";
import { loadNextLead } from "../leads/nextLead.js";
import { createGoogleSpreadsheet, inspectGoogleSpreadsheet, writeGoogleHeaderRow } from "../sheets/admin.js";
import { attachSheetsConfig } from "../sheets/bind.js";
import { parseSpreadsheetId } from "../sheets/id.js";
import { headerRow, standardSheetsConfig } from "../sheets/template.js";
import { preflightHeaders } from "../sheets/preflight.js";

function googleJson(ctx: AppContext): string | null {
  const json = ctx.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  return json ? json : null;
}

export async function registerSheets(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };

  app.post("/api/sheets/create", { preHandler: auth }, async (request, reply) => {
    const parsed = z.object({
      title: z.string().trim().min(1).max(160).default("Sales Engine Leads"),
      shareEmail: z.string().trim().max(320).optional()
    }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Provide a Sheet title." });
    const shareEmail = parsed.data.shareEmail?.trim() || undefined;
    if (shareEmail && !z.string().email().safeParse(shareEmail).success) {
      return reply.code(400).send({ error: "Share with a valid Google email, or leave it blank." });
    }
    if (resolveSheetsBackend(ctx.env) !== "google") {
      return reply.code(409).send({ error: "Creating a Google Sheet needs SHEETS_BACKEND=google." });
    }
    const json = googleJson(ctx);
    if (!json) return reply.code(503).send({ error: "Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 before creating a Sheet." });
    try {
      const created = await createGoogleSpreadsheet(
        json,
        parsed.data.title,
        shareEmail
      );
      const config = standardSheetsConfig(created.spreadsheetId, created.sheetName);
      const attached = await attachSheetsConfig(ctx, config);
      if (!attached.ok) return reply.code(502).send({ error: attached.message });
      const next = await loadNextLead(ctx);
      return {
        spreadsheetId: created.spreadsheetId,
        url: created.url,
        title: created.title,
        sheetName: created.sheetName,
        created: true,
        sheet: next.sheetStatus
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create the Google Sheet.";
      return reply.code(502).send({ error: message });
    }
  });

  app.post("/api/sheets/link", { preHandler: auth }, async (request, reply) => {
    const parsed = z.object({
      spreadsheet: z.string().trim().min(1).max(2000)
    }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Paste a Google Sheet URL or ID." });
    if (resolveSheetsBackend(ctx.env) !== "google") {
      return reply.code(409).send({ error: "Linking a Google Sheet needs SHEETS_BACKEND=google." });
    }
    const json = googleJson(ctx);
    if (!json) return reply.code(503).send({ error: "Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 before linking a Sheet." });
    const spreadsheetId = parseSpreadsheetId(parsed.data.spreadsheet);
    if (!spreadsheetId) return reply.code(400).send({ error: "That does not look like a Google Sheet URL or ID." });
    try {
      const draft = standardSheetsConfig(spreadsheetId);
      const inspected = await inspectGoogleSpreadsheet(json, spreadsheetId, draft.sheet_name);
      const config = standardSheetsConfig(spreadsheetId, inspected.sheetName);
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
      const attached = await attachSheetsConfig(ctx, config);
      if (!attached.ok) return reply.code(502).send({ error: attached.message });
      const next = await loadNextLead(ctx);
      return {
        spreadsheetId,
        url: next.sheetStatus.url,
        title: inspected.title,
        sheetName: config.sheet_name,
        created: false,
        initializedHeaders,
        sheet: next.sheetStatus
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open that Google Sheet.";
      return reply.code(502).send({ error: message });
    }
  });
}
