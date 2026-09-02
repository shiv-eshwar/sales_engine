import { describe, expect, it } from "vitest";
import { loadSheetsConfig } from "../../src/server/config/sheets.js";
import { SheetAdapter } from "../../src/server/sheets/adapter.js";
import { EXAMPLE_HEADERS, exampleFixtureRows } from "../../src/server/sheets/fixture.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";

const config = loadSheetsConfig("config/sheets.example.yaml");

describe("eligible queue", () => {
  it("skips blank and duplicate lead IDs and ineligible statuses", async () => {
    const store = new MemorySheetStore(EXAMPLE_HEADERS, exampleFixtureRows());
    const adapter = new SheetAdapter(store, config, ["US"]);
    const queue = await adapter.loadQueue();
    const ids = queue.leads.map((lead) => lead.leadId);

    expect(ids).toContain("L-100");
    expect(ids).toContain("L-101");
    expect(ids).toContain("L-102");
    expect(ids).not.toContain("L-200");
    expect(ids).not.toContain("L-DUP");
    expect(ids).not.toContain("");

    expect(queue.diagnostics.some((item) => item.code === "blank_lead_id")).toBe(true);
    expect(queue.diagnostics.some((item) => item.code === "duplicate_lead_id")).toBe(true);
    expect(queue.leads.find((lead) => lead.leadId === "L-102")?.dialable).toBe(false);
  });

  it("blocks writes when the phone no longer matches the snapshot", async () => {
    const store = new MemorySheetStore(EXAMPLE_HEADERS, exampleFixtureRows());
    const adapter = new SheetAdapter(store, config, ["US"]);
    const result = await adapter.applyApprovedWrite({
      leadId: "L-100",
      snapshotPhone: "+19999999999",
      fields: { call_status: "Completed" }
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.code).toBe("identity_conflict");
    expect(store.writeCount).toBe(0);
  });
});
