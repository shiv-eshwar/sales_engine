import { describe, expect, it } from "vitest";
import { openDatabase, migrate } from "../../src/server/db/index.js";
import { loadSheetsConfig } from "../../src/server/config/sheets.js";
import { SheetAdapter } from "../../src/server/sheets/adapter.js";
import { EXAMPLE_HEADERS, exampleFixtureRows } from "../../src/server/sheets/fixture.js";
import { asLiteralSheetValue } from "../../src/server/sheets/literal.js";
import { MemorySheetStore } from "../../src/server/sheets/memory.js";

const config = loadSheetsConfig("config/sheets.example.yaml");

describe("formula-safe sheet writes", () => {
  it("prefixes formula-like strings so they are stored as literal text", () => {
    expect(asLiteralSheetValue("=SUM(1,2)")).toBe("'=SUM(1,2)");
    expect(asLiteralSheetValue("+123")).toBe("'+123");
    expect(asLiteralSheetValue("-1")).toBe("'-1");
    expect(asLiteralSheetValue("@mention")).toBe("'@mention");
    expect(asLiteralSheetValue("plain text")).toBe("plain text");
  });

  it("writes escaped values through the adapter and verifies them", async () => {
    const store = new MemorySheetStore(EXAMPLE_HEADERS, exampleFixtureRows());
    const adapter = new SheetAdapter(store, config, ["US"]);
    const result = await adapter.applyApprovedWrite({
      leadId: "L-100",
      snapshotPhone: "+14155550100",
      fields: { next_step: "=HYPERLINK(\"https://evil.example\")" }
    });
    expect(result.ok).toBe(true);
    const rows = await store.getDataRows();
    const written = rows[0]?.values[EXAMPLE_HEADERS.indexOf("Next Step")];
    expect(written?.startsWith("'=")).toBe(true);
  });

  it("stores a pending_retry ledger row when the write fails", async () => {
    const db = openDatabase(":memory:");
    migrate(db, "migrations");
    const store = new MemorySheetStore(EXAMPLE_HEADERS, exampleFixtureRows());
    store.failNextWrite();
    const adapter = new SheetAdapter(store, config, ["US"], db);
    const result = await adapter.applyApprovedWrite({
      leadId: "L-100",
      snapshotPhone: "+14155550100",
      fields: { call_summary: "Tried to write" }
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.pendingRetryId).toBeTruthy();
    const row = db
      .prepare("SELECT status FROM post_call_proposals WHERE id = ?")
      .get(result.pendingRetryId) as { status: string };
    expect(row.status).toBe("pending_retry");
    db.close();
  });
});
