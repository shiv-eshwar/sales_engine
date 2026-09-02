export type SheetCellUpdate = {
  rowNumber: number;
  columnIndex: number;
  header: string;
  value: string;
};

export interface SheetStore {
  readonly kind: "memory" | "google";
  getHeaders(): Promise<string[]>;
  getDataRows(): Promise<Array<{ rowNumber: number; values: string[] }>>;
  batchUpdate(updates: SheetCellUpdate[]): Promise<void>;
  readRow(rowNumber: number): Promise<string[]>;
}
