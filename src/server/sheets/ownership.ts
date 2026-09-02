import type { SheetsConfig } from "../../shared/schemas.js";
import type { WriteFields } from "../../shared/types.js";

export class OwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipError";
  }
}

export function gumloopOwned(config: SheetsConfig): Set<string> {
  return new Set(config.ownership.gumloop_owned);
}

export function applicationOwned(config: SheetsConfig): Set<string> {
  return new Set(config.ownership.application_owned);
}

export function allowlistedWriteHeaders(config: SheetsConfig): Set<string> {
  const owned = applicationOwned(config);
  const gumloop = gumloopOwned(config);
  const allow = new Set<string>();
  for (const header of Object.values(config.write_columns)) {
    if (gumloop.has(header) || !owned.has(header)) {
      throw new OwnershipError(
        `Write column "${header}" is not an application-owned allowlisted field`
      );
    }
    allow.add(header);
  }
  return allow;
}

export function headerForWriteKey(config: SheetsConfig, key: keyof WriteFields): string {
  return config.write_columns[key];
}

export function assertWritableHeaders(config: SheetsConfig, headers: string[]): void {
  const gumloop = gumloopOwned(config);
  const allow = allowlistedWriteHeaders(config);
  for (const header of headers) {
    if (gumloop.has(header)) {
      throw new OwnershipError(`Refusing to write Gumloop-owned column "${header}"`);
    }
    if (!allow.has(header)) {
      throw new OwnershipError(`Refusing to write non-allowlisted column "${header}"`);
    }
  }
}

export function writeEntries(
  config: SheetsConfig,
  fields: WriteFields
): Array<{ key: keyof WriteFields; header: string; value: string }> {
  const entries: Array<{ key: keyof WriteFields; header: string; value: string }> = [];
  for (const [key, value] of Object.entries(fields) as Array<[keyof WriteFields, string | undefined]>) {
    if (value === undefined) {
      continue;
    }
    entries.push({ key, header: headerForWriteKey(config, key), value });
  }
  assertWritableHeaders(
    config,
    entries.map((entry) => entry.header)
  );
  return entries;
}
