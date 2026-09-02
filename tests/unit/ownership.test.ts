import { describe, expect, it } from "vitest";
import { loadSheetsConfig } from "../../src/server/config/sheets.js";
import { assertWritableHeaders, OwnershipError, writeEntries } from "../../src/server/sheets/ownership.js";

const config = loadSheetsConfig("config/sheets.example.yaml");

describe("writable field validator", () => {
  it("rejects Gumloop-owned headers", () => {
    expect(() => assertWritableHeaders(config, ["Full Name"])).toThrow(OwnershipError);
    expect(() => assertWritableHeaders(config, ["Phone"])).toThrow(/Gumloop-owned/);
    expect(() => assertWritableHeaders(config, ["Enrichment"])).toThrow(OwnershipError);
  });

  it("rejects headers that are not allowlisted writes", () => {
    expect(() => assertWritableHeaders(config, ["Unknown Column"])).toThrow(/non-allowlisted/);
  });

  it("allows application-owned write columns", () => {
    expect(() => assertWritableHeaders(config, ["Call Status", "Call Summary"])).not.toThrow();
    const entries = writeEntries(config, { call_status: "Retry", call_summary: "Left voicemail" });
    expect(entries.map((entry) => entry.header)).toEqual(["Call Status", "Call Summary"]);
  });
});
