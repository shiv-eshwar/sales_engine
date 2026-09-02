import type { SheetCellUpdate, SheetStore } from "./store.js";

export class MemorySheetStore implements SheetStore {
  readonly kind = "memory" as const;
  writeCount = 0;
  private failOnce = false;
  private readonly rows: string[][];

  constructor(
    private headers: string[],
    dataRows: string[][],
    private readonly headerRow = 1
  ) {
    this.rows = dataRows.map((row) => [...row]);
  }

  async getHeaders(): Promise<string[]> {
    return [...this.headers];
  }

  async getDataRows(): Promise<Array<{ rowNumber: number; values: string[] }>> {
    return this.rows.map((values, offset) => ({
      rowNumber: this.headerRow + 1 + offset,
      values: [...values]
    }));
  }

  failNextWrite(): void {
    this.failOnce = true;
  }

  async batchUpdate(updates: SheetCellUpdate[]): Promise<void> {
    if (this.failOnce) {
      this.failOnce = false;
      throw new Error("Sheets API unavailable");
    }
    this.writeCount += 1;
    for (const update of updates) {
      const offset = update.rowNumber - this.headerRow - 1;
      const row = this.rows[offset];
      if (!row) {
        throw new Error(`Memory sheet has no row ${update.rowNumber}`);
      }
      while (row.length <= update.columnIndex) {
        row.push("");
      }
      row[update.columnIndex] = update.value;
    }
  }

  async readRow(rowNumber: number): Promise<string[]> {
    const offset = rowNumber - this.headerRow - 1;
    const row = this.rows[offset];
    if (!row) {
      throw new Error(`Memory sheet has no row ${rowNumber}`);
    }
    return [...row];
  }
}
