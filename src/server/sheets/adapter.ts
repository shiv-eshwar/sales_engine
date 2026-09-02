import type Database from "better-sqlite3";
import type { CountryCode } from "libphonenumber-js";
import type { SheetsConfig } from "../../shared/schemas.js";
import type { ApplyWriteInput, ApplyWriteResult, QueueResult } from "../../shared/types.js";
import { storePendingRetry } from "../db/proposals.js";
import { asLiteralSheetValue, storedSheetValueLooksLike } from "./literal.js";
import { OwnershipError, writeEntries } from "./ownership.js";
import { cell, preflightHeaders, requireHeaderIndex, type HeaderIndex } from "./preflight.js";
import { buildQueue } from "./queue.js";
import type { SheetStore } from "./store.js";

export class SheetAdapter {
  private headerCache: { headers: string[]; index: HeaderIndex } | null = null;

  constructor(
    readonly store: SheetStore,
    private readonly config: SheetsConfig,
    private readonly allowedCountries: CountryCode[],
    private readonly db?: Database.Database
  ) {}

  async preflight(): Promise<{ ok: true } | { ok: false; errors: string[] }> {
    const headers = await this.store.getHeaders();
    const errors = preflightHeaders(this.config, headers);
    if (errors.length > 0) {
      this.headerCache = null;
      return { ok: false, errors: errors.map((error) => error.message) };
    }
    this.headerCache = { headers, index: requireHeaderIndex(this.config, headers) };
    return { ok: true };
  }

  async loadQueue(): Promise<QueueResult> {
    const ready = await this.ensureIndex();
    const rows = await this.store.getDataRows();
    return buildQueue(this.config, ready.index, rows, this.allowedCountries);
  }

  async findLeadById(leadId: string): Promise<QueueResult["leads"][number] | null> {
    const queue = await this.loadQueue();
    return queue.leads.find((lead) => lead.leadId === leadId) ?? null;
  }

  async applyApprovedWrite(input: ApplyWriteInput): Promise<ApplyWriteResult> {
    const ready = await this.preflight();
    if (!ready.ok) {
      return { ok: false, code: "preflight", message: ready.errors.join(" ") };
    }

    let entries;
    try {
      entries = writeEntries(this.config, input.fields);
    } catch (error) {
      const message = error instanceof OwnershipError ? error.message : String(error);
      return { ok: false, code: "ownership", message };
    }

    const resolved = await this.resolveLead(input.leadId);
    if (!resolved) {
      return { ok: false, code: "not_found", message: `Lead "${input.leadId}" was not found` };
    }

    const currentPhone = cell(resolved.values, resolved.index, this.config.read_columns.phone);
    const currentId = cell(resolved.values, resolved.index, this.config.read_columns.lead_id);
    if (currentId !== input.leadId || currentPhone !== input.snapshotPhone) {
      return {
        ok: false,
        code: "identity_conflict",
        message:
          "Lead ID or phone no longer matches the call snapshot. The write was blocked so the wrong row cannot be updated."
      };
    }

    const updates = entries.map((entry) => ({
      rowNumber: resolved.rowNumber,
      columnIndex: resolved.index.get(entry.header) ?? -1,
      header: entry.header,
      value: asLiteralSheetValue(entry.value)
    }));

    if (updates.some((update) => update.columnIndex < 0)) {
      return { ok: false, code: "preflight", message: "A write column is missing from the header index" };
    }

    try {
      await this.store.batchUpdate(updates);
      const readBack = await this.store.readRow(resolved.rowNumber);
      const verified: Record<string, string> = {};
      for (const entry of entries) {
        const column = resolved.index.get(entry.header);
        if (column === undefined) {
          throw new Error(`Missing column ${entry.header} after write`);
        }
        const stored = (readBack[column] ?? "").toString();
        if (!storedSheetValueLooksLike(entry.value, stored)) {
          throw new Error(`Read-back mismatch for "${entry.header}"`);
        }
        verified[entry.key] = stored;
      }
      return { ok: true, verified };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (input.proposalId) {
        return { ok: false, code: "verify_failed", message, pendingRetryId: input.proposalId };
      }
      const pendingRetryId = this.db
        ? storePendingRetry(this.db, { leadId: input.leadId, fields: input.fields }, message)
        : undefined;
      return { ok: false, code: "verify_failed", message, pendingRetryId };
    }
  }

  async readApplicationSnapshot(leadId: string): Promise<{
    phone: string;
    cells: Record<string, string>;
  } | null> {
    const resolved = await this.resolveLead(leadId);
    if (!resolved) {
      return null;
    }
    const cells: Record<string, string> = {};
    for (const header of resolved.index.keys()) {
      cells[header] = cell(resolved.values, resolved.index, header);
    }
    return {
      phone: cell(resolved.values, resolved.index, this.config.read_columns.phone),
      cells
    };
  }

  private async ensureIndex(): Promise<{ headers: string[]; index: HeaderIndex }> {
    if (this.headerCache) {
      return this.headerCache;
    }
    const ready = await this.preflight();
    if (!ready.ok || !this.headerCache) {
      throw new Error(ready.ok ? "Sheet preflight cache missing" : ready.errors.join(" "));
    }
    return this.headerCache;
  }

  private async resolveLead(leadId: string): Promise<{
    rowNumber: number;
    values: string[];
    index: HeaderIndex;
  } | null> {
    const { index } = await this.ensureIndex();
    const rows = await this.store.getDataRows();
    const matches = rows.filter(
      (row) => cell(row.values, index, this.config.read_columns.lead_id) === leadId
    );
    if (matches.length !== 1 || !matches[0]) {
      return null;
    }
    return { rowNumber: matches[0].rowNumber, values: matches[0].values, index };
  }
}
