import type { SheetsConfig } from "../../shared/schemas.js";

export type HeaderIndex = Map<string, number>;

export type PreflightError = {
  code: "missing_header" | "duplicate_header";
  header: string;
  message: string;
};

export function buildHeaderIndex(headers: string[]): {
  index: HeaderIndex;
  duplicates: string[];
} {
  const index: HeaderIndex = new Map();
  const seen = new Map<string, number>();
  const duplicates: string[] = [];

  headers.forEach((raw, column) => {
    const header = raw.trim();
    if (header === "") {
      return;
    }
    const count = (seen.get(header) ?? 0) + 1;
    seen.set(header, count);
    if (count === 1) {
      index.set(header, column);
    }
    if (count === 2) {
      duplicates.push(header);
      index.delete(header);
    }
  });

  return { index, duplicates };
}

export function configuredHeaders(config: SheetsConfig): string[] {
  const headers = new Set<string>();
  headers.add(config.identity_column);
  for (const header of Object.values(config.read_columns)) {
    headers.add(header);
  }
  for (const header of Object.values(config.write_columns)) {
    headers.add(header);
  }
  return [...headers];
}

export function preflightHeaders(config: SheetsConfig, headers: string[]): PreflightError[] {
  const { index, duplicates } = buildHeaderIndex(headers);
  const errors: PreflightError[] = [];

  for (const header of duplicates) {
    errors.push({
      code: "duplicate_header",
      header,
      message: `Header "${header}" appears more than once. Fix the Sheet; the application will not write.`
    });
  }

  for (const header of configuredHeaders(config)) {
    if (duplicates.includes(header)) {
      continue;
    }
    if (!index.has(header)) {
      errors.push({
        code: "missing_header",
        header,
        message: `Configured header "${header}" was not found in the Sheet header row.`
      });
    }
  }

  return errors;
}

export function requireHeaderIndex(config: SheetsConfig, headers: string[]): HeaderIndex {
  const errors = preflightHeaders(config, headers);
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.message).join(" "));
  }
  return buildHeaderIndex(headers).index;
}

export function cell(row: string[], index: HeaderIndex, header: string): string {
  const column = index.get(header);
  if (column === undefined) {
    return "";
  }
  return (row[column] ?? "").trim();
}
