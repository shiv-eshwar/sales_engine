import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { sheetsConfigSchema, type SheetsConfig } from "../../shared/schemas.js";

export function loadSheetsConfig(path: string): SheetsConfig {
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = parse(raw);
  return sheetsConfigSchema.parse(parsed);
}
