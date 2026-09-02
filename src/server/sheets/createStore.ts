import type { CountryCode } from "libphonenumber-js";
import type { Env } from "../env.js";
import { resolveSheetsBackend } from "../env.js";
import { parseAllowedCountries } from "../../shared/phone.js";
import type { SheetsConfig } from "../../shared/schemas.js";
import { GoogleSheetStore } from "./google.js";
import { createExampleMemoryStore } from "./fixture.js";
import type { SheetStore } from "./store.js";

export function createSheetStore(env: Env, config: SheetsConfig): SheetStore | null {
  const backend = resolveSheetsBackend(env);
  if (backend === "none") {
    return null;
  }
  if (backend === "memory") {
    return createExampleMemoryStore(config);
  }
  const json = env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!json) {
    return null;
  }
  return new GoogleSheetStore(config, json);
}

export function allowedCountriesFromEnv(env: Env): CountryCode[] {
  return parseAllowedCountries(env.TWILIO_ALLOWED_COUNTRIES);
}
