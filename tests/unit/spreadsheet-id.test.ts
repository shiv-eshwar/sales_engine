import { describe, expect, it } from "vitest";
import { parseSpreadsheetId, spreadsheetUrl } from "../../src/server/sheets/id.js";

describe("spreadsheet id parsing", () => {
  it("accepts a full Google Sheets URL", () => {
    expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/1abcDEF-123_xyz/edit#gid=0")).toBe("1abcDEF-123_xyz");
  });

  it("accepts a bare spreadsheet ID", () => {
    expect(parseSpreadsheetId("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")).toBe(
      "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
    );
  });

  it("rejects short or unrelated text", () => {
    expect(parseSpreadsheetId("not-a-sheet")).toBeNull();
    expect(parseSpreadsheetId("")).toBeNull();
  });

  it("builds the edit URL", () => {
    expect(spreadsheetUrl("abc")).toBe("https://docs.google.com/spreadsheets/d/abc/edit");
  });
});
