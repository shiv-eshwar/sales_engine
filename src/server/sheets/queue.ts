import type { CountryCode } from "libphonenumber-js";
import type { SheetsConfig } from "../../shared/schemas.js";
import { normalizePhone } from "../../shared/phone.js";
import type { LeadRecord, QueueResult } from "../../shared/types.js";
import { cell, type HeaderIndex } from "./preflight.js";

function fieldHeader(config: SheetsConfig, field: string): string | undefined {
  if (field in config.read_columns) {
    return config.read_columns[field as keyof typeof config.read_columns];
  }
  if (field in config.write_columns) {
    return config.write_columns[field as keyof typeof config.write_columns];
  }
  return undefined;
}

export function isEligible(config: SheetsConfig, index: HeaderIndex, row: string[]): boolean {
  for (const [field, allowed] of Object.entries(config.eligible_when)) {
    const header = fieldHeader(config, field);
    if (!header) {
      return false;
    }
    const value = cell(row, index, header);
    if (!allowed.includes(value)) {
      return false;
    }
  }
  return true;
}

export function parseLeadRow(
  config: SheetsConfig,
  index: HeaderIndex,
  row: string[],
  rowNumber: number,
  allowedCountries: CountryCode[]
): Omit<LeadRecord, "issues"> & { rawLeadId: string } {
  const rawLeadId = cell(row, index, config.read_columns.lead_id);
  const phone = cell(row, index, config.read_columns.phone);
  const parsed = normalizePhone(phone, allowedCountries);
  const cells: Record<string, string> = {};
  for (const header of index.keys()) {
    cells[header] = cell(row, index, header);
  }

  return {
    rawLeadId,
    leadId: rawLeadId,
    fullName: cell(row, index, config.read_columns.full_name),
    phone,
    phoneE164: parsed.ok ? parsed.e164 : null,
    dialable: parsed.ok,
    company: cell(row, index, config.read_columns.company),
    role: cell(row, index, config.read_columns.role),
    enrichment: cell(row, index, config.read_columns.enrichment),
    campaignId: cell(row, index, config.read_columns.campaign_id),
    crmStatus: cell(row, index, config.read_columns.crm_status),
    callStatus: cell(row, index, config.write_columns.call_status),
    rowNumber,
    cells
  };
}

export function buildQueue(
  config: SheetsConfig,
  index: HeaderIndex,
  dataRows: Array<{ rowNumber: number; values: string[] }>,
  allowedCountries: CountryCode[]
): QueueResult {
  const diagnostics: QueueResult["diagnostics"] = [];
  const counts = new Map<string, number>();

  for (const data of dataRows) {
    const leadId = cell(data.values, index, config.read_columns.lead_id);
    if (leadId === "") {
      diagnostics.push({
        code: "blank_lead_id",
        message: `Row ${data.rowNumber} has a blank Lead ID and will be skipped.`,
        rowNumber: data.rowNumber
      });
      continue;
    }
    counts.set(leadId, (counts.get(leadId) ?? 0) + 1);
  }

  for (const [leadId, count] of counts) {
    if (count > 1) {
      diagnostics.push({
        code: "duplicate_lead_id",
        message: `Lead ID "${leadId}" appears ${count} times and will be skipped.`,
        leadId
      });
    }
  }

  const duplicateIds = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([leadId]) => leadId)
  );

  const leads: LeadRecord[] = [];

  for (const data of dataRows) {
    const parsed = parseLeadRow(config, index, data.values, data.rowNumber, allowedCountries);
    if (parsed.rawLeadId === "" || duplicateIds.has(parsed.rawLeadId)) {
      continue;
    }
    if (!isEligible(config, index, data.values)) {
      continue;
    }

    const issues: string[] = [];
    if (!parsed.dialable) {
      issues.push("Phone is not dialable");
      diagnostics.push({
        code: "invalid_phone",
        message: `Lead ${parsed.rawLeadId} has an invalid phone number.`,
        leadId: parsed.rawLeadId,
        rowNumber: data.rowNumber
      });
    }

    leads.push({ ...parsed, leadId: parsed.rawLeadId, issues });
  }

  return { leads, diagnostics };
}
