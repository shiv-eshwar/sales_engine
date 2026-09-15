import type { PublicLead } from "./contracts.js";

export type LeadSortKey = "queue" | "name" | "company" | "status";

export const LEADS_PAGE_SIZE = 40;
export const LEADS_PAGE_SIZE_MAX = 100;

export type LeadsListQueryKey = {
  campaignId: string | null;
  q: string;
  dialableOnly: boolean;
  sort: LeadSortKey;
  dir: 1 | -1;
};

export function sortLeads(leads: PublicLead[], key: LeadSortKey, dir: 1 | -1): PublicLead[] {
  if (key === "queue") {
    const items = [...leads];
    return dir === -1 ? items.reverse() : items;
  }
  const pick = (lead: PublicLead): string => {
    if (key === "company") return `${lead.company} ${lead.fullName}`.toLowerCase();
    if (key === "status") return `${lead.callStatus} ${lead.crmStatus} ${lead.fullName}`.toLowerCase();
    return `${lead.fullName} ${lead.company}`.toLowerCase();
  };
  return [...leads].sort((a, b) => {
    const left = pick(a);
    const right = pick(b);
    if (left < right) return -1 * dir;
    if (left > right) return 1 * dir;
    return 0;
  });
}

export function filterLeads(leads: PublicLead[], query: string, dialableOnly: boolean): PublicLead[] {
  const needle = query.trim().toLowerCase();
  return leads.filter((lead) => {
    if (dialableOnly && !lead.dialable) return false;
    if (!needle) return true;
    return [lead.fullName, lead.company, lead.role, lead.phone, lead.phoneE164 ?? "", lead.leadId]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function leadsListQueryKey(input: LeadsListQueryKey): string {
  return JSON.stringify({
    campaignId: input.campaignId,
    q: input.q.trim().toLowerCase(),
    dialableOnly: input.dialableOnly,
    sort: input.sort,
    dir: input.dir
  });
}

/** Drop the cursor when search, filters, sort, or campaign change so the next fetch replaces rows. */
export function cursorForLeadsQuery(
  previousKey: string | null,
  nextKey: string,
  currentCursor: string | null
): string | null {
  if (previousKey !== nextKey) return null;
  return currentCursor;
}

export function clampLeadsLimit(value: unknown, fallback = LEADS_PAGE_SIZE): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(LEADS_PAGE_SIZE_MAX, Math.max(1, Math.trunc(n)));
}

export function parseLeadsOffset(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const n = Number.parseInt(cursor, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function nextLeadsCursor(offset: number, taken: number, filteredTotal: number): string | null {
  const next = offset + taken;
  if (taken <= 0 || next >= filteredTotal) return null;
  return String(next);
}

export function sliceLeadsPage<T>(items: T[], cursor: string | null | undefined, limit: number): {
  items: T[];
  nextCursor: string | null;
  offset: number;
} {
  const offset = parseLeadsOffset(cursor);
  const page = items.slice(offset, offset + limit);
  return {
    items: page,
    nextCursor: nextLeadsCursor(offset, page.length, items.length),
    offset
  };
}

export function paginateLeads(
  leads: PublicLead[],
  input: {
    q: string;
    dialableOnly: boolean;
    sort: LeadSortKey;
    dir: 1 | -1;
    cursor?: string | null;
    limit: number;
  }
): {
  items: PublicLead[];
  nextCursor: string | null;
  total: number;
  undialableCount: number;
  queueSize: number;
} {
  const filtered = filterLeads(leads, input.q, input.dialableOnly);
  const sorted = sortLeads(filtered, input.sort, input.dir);
  const page = sliceLeadsPage(sorted, input.cursor, input.limit);
  return {
    items: page.items,
    nextCursor: page.nextCursor,
    total: filtered.length,
    undialableCount: leads.filter((lead) => !lead.dialable).length,
    queueSize: leads.length
  };
}
