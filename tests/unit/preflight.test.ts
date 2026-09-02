import { describe, expect, it } from "vitest";
import { loadSheetsConfig } from "../../src/server/config/sheets.js";
import { SheetAdapter } from "../../src/server/sheets/adapter.js";
import { EXAMPLE_HEADERS, exampleFixtureRows, reorderHeaders } from "../../src/server/sheets/fixture.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";
import { preflightHeaders } from "../../src/server/sheets/preflight.js";

const config = loadSheetsConfig("config/sheets.example.yaml");

describe("sheet header preflight", () => {
  it("maps leads after columns are reordered", async () => {
    const headers = reorderHeaders(EXAMPLE_HEADERS, 0, 6);
    const rows = exampleFixtureRows().map((row) => reorderHeaders(row, 0, 6));
    const store = new MemorySheetStore(headers, rows);
    const adapter = new SheetAdapter(store, config, ["US"]);

    const preflight = await adapter.preflight();
    expect(preflight).toEqual({ ok: true });

    const queue = await adapter.loadQueue();
    expect(queue.leads.map((lead) => lead.leadId)).toContain("L-100");
    expect(queue.leads.find((lead) => lead.leadId === "L-100")?.fullName).toBe("Alex Rivera");
  });

  it("fails preflight for a missing header and never writes", async () => {
    const headers = EXAMPLE_HEADERS.filter((header) => header !== "Phone");
    const store = new MemorySheetStore(headers, exampleFixtureRows());
    const adapter = new SheetAdapter(store, config, ["US"]);

    const preflight = await adapter.preflight();
    expect(preflight.ok).toBe(false);
    if (preflight.ok) {
      throw new Error("expected failure");
    }
    expect(preflight.errors.join(" ")).toMatch(/Phone/);

    const write = await adapter.applyApprovedWrite({
      leadId: "L-100",
      snapshotPhone: "+14155550100",
      fields: { call_status: "Completed" }
    });
    expect(write.ok).toBe(false);
    expect(store.writeCount).toBe(0);
  });

  it("fails preflight for duplicate headers and never writes", async () => {
    const headers = [...EXAMPLE_HEADERS, "Phone"];
    const store = new MemorySheetStore(headers, exampleFixtureRows());
    const adapter = new SheetAdapter(store, config, ["US"]);

    const errors = preflightHeaders(config, headers);
    expect(errors.some((error) => error.code === "duplicate_header" && error.header === "Phone")).toBe(
      true
    );

    const write = await adapter.applyApprovedWrite({
      leadId: "L-100",
      snapshotPhone: "+14155550100",
      fields: { next_step: "Follow up" }
    });
    expect(write.ok).toBe(false);
    expect(store.writeCount).toBe(0);
  });
});
