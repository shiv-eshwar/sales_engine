import { google } from "googleapis";
import type { SheetsConfig } from "../../shared/schemas.js";
import { a1Cell } from "./a1.js";
import type { SheetCellUpdate, SheetStore } from "./store.js";

function credentialsFromBase64(raw: string): object {
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as object;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64 JSON");
  }
}

export class GoogleSheetStore implements SheetStore {
  readonly kind = "google" as const;
  private readonly sheets;

  constructor(
    private readonly config: SheetsConfig,
    serviceAccountJsonBase64: string
  ) {
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsFromBase64(serviceAccountJsonBase64),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    this.sheets = google.sheets({ version: "v4", auth });
  }

  async getHeaders(): Promise<string[]> {
    const row = this.config.header_row;
    const range = `${this.config.sheet_name}!${row}:${row}`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheet_id,
      range
    });
    return (response.data.values?.[0] ?? []).map((value) => String(value));
  }

  async getDataRows(): Promise<Array<{ rowNumber: number; values: string[] }>> {
    const start = this.config.header_row + 1;
    const range = `${this.config.sheet_name}!A${start}:ZZ`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheet_id,
      range
    });
    const values = response.data.values ?? [];
    return values.map((row, offset) => ({
      rowNumber: start + offset,
      values: row.map((cell) => String(cell ?? ""))
    }));
  }

  async batchUpdate(updates: SheetCellUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.spreadsheet_id,
      requestBody: {
        valueInputOption: "RAW",
        data: updates.map((update) => ({
          range: a1Cell(this.config.sheet_name, update.columnIndex, update.rowNumber),
          values: [[update.value]]
        }))
      }
    });
  }

  async readRow(rowNumber: number): Promise<string[]> {
    const range = `${this.config.sheet_name}!A${rowNumber}:ZZ${rowNumber}`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheet_id,
      range
    });
    return (response.data.values?.[0] ?? []).map((value) => String(value ?? ""));
  }
}
