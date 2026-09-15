import { describe, expect, it } from "vitest";
import type { PublicLead } from "../../src/shared/contracts.js";
import {
  cursorForLeadsQuery,
  leadsListQueryKey,
  nextLeadsCursor,
  paginateLeads
} from "../../src/shared/leadsQueue.js";

function lead(id: number, extras: Partial<PublicLead> = {}): PublicLead {
  return {
    leadId: `L-${id}`,
    fullName: `Contact ${String(id).padStart(3, "0")}`,
    phone: `+1202555${String(id).padStart(4, "0")}`,
    phoneE164: `+1202555${String(id).padStart(4, "0")}`,
    dialable: id % 10 !== 0,
    company: `Company ${id % 7}`,
    role: "Operator",
    enrichment: "",
    campaignId: "camp",
    crmStatus: "Ready",
    callStatus: "",
    issues: [],
    ...extras
  };
}

describe("leads pagination", () => {
  const leads = Array.from({ length: 95 }, (_, i) => lead(i + 1));

  it("returns the next offset cursor until the filtered list is exhausted", () => {
    const first = paginateLeads(leads, {
      q: "",
      dialableOnly: false,
      sort: "name",
      dir: 1,
      cursor: null,
      limit: 40
    });
    expect(first.items).toHaveLength(40);
    expect(first.total).toBe(95);
    expect(first.nextCursor).toBe("40");
    expect(nextLeadsCursor(0, 40, 95)).toBe("40");

    const second = paginateLeads(leads, {
      q: "",
      dialableOnly: false,
      sort: "name",
      dir: 1,
      cursor: first.nextCursor,
      limit: 40
    });
    expect(second.items).toHaveLength(40);
    expect(second.nextCursor).toBe("80");

    const last = paginateLeads(leads, {
      q: "",
      dialableOnly: false,
      sort: "name",
      dir: 1,
      cursor: second.nextCursor,
      limit: 40
    });
    expect(last.items).toHaveLength(15);
    expect(last.nextCursor).toBeNull();
    expect(nextLeadsCursor(80, 15, 95)).toBeNull();
  });

  it("resets the cursor when search, filter, sort, or campaign changes", () => {
    const base = leadsListQueryKey({
      campaignId: "a",
      q: "",
      dialableOnly: true,
      sort: "name",
      dir: 1
    });
    expect(cursorForLeadsQuery(base, base, "40")).toBe("40");
    expect(
      cursorForLeadsQuery(
        base,
        leadsListQueryKey({ campaignId: "a", q: "jordan", dialableOnly: true, sort: "name", dir: 1 }),
        "40"
      )
    ).toBeNull();
    expect(
      cursorForLeadsQuery(
        base,
        leadsListQueryKey({ campaignId: "a", q: "", dialableOnly: false, sort: "name", dir: 1 }),
        "40"
      )
    ).toBeNull();
    expect(
      cursorForLeadsQuery(
        base,
        leadsListQueryKey({ campaignId: "a", q: "", dialableOnly: true, sort: "company", dir: 1 }),
        "40"
      )
    ).toBeNull();
    expect(
      cursorForLeadsQuery(
        base,
        leadsListQueryKey({ campaignId: "b", q: "", dialableOnly: true, sort: "name", dir: 1 }),
        "40"
      )
    ).toBeNull();
  });

  it("applies ready filter before paging a long list", () => {
    const page = paginateLeads(leads, {
      q: "",
      dialableOnly: true,
      sort: "name",
      dir: 1,
      cursor: null,
      limit: 40
    });
    expect(page.items.every((item) => item.dialable)).toBe(true);
    expect(page.undialableCount).toBe(leads.filter((item) => !item.dialable).length);
    expect(page.queueSize).toBe(95);
  });

  it("preserves Sheet order when sort is queue", () => {
    const mixed = [
      lead(2, { fullName: "Zed Last" }),
      lead(1, { fullName: "Amy First" })
    ];
    const queued = paginateLeads(mixed, {
      q: "",
      dialableOnly: false,
      sort: "queue",
      dir: 1,
      cursor: null,
      limit: 10
    });
    expect(queued.items.map((item) => item.leadId)).toEqual(["L-2", "L-1"]);

    const reversed = paginateLeads(mixed, {
      q: "",
      dialableOnly: false,
      sort: "queue",
      dir: -1,
      cursor: null,
      limit: 10
    });
    expect(reversed.items.map((item) => item.leadId)).toEqual(["L-1", "L-2"]);

    const named = paginateLeads(mixed, {
      q: "",
      dialableOnly: false,
      sort: "name",
      dir: 1,
      cursor: null,
      limit: 10
    });
    expect(named.items.map((item) => item.leadId)).toEqual(["L-1", "L-2"]);
  });
});
