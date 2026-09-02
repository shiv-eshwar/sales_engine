import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { playbookConfigSchema, type PlaybookConfig } from "../../shared/schemas.js";

export function loadPlaybook(path: string): PlaybookConfig {
  const parsed: unknown = parse(readFileSync(path, "utf8"));
  return playbookConfigSchema.parse(parsed);
}
