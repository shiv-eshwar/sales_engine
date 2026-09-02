import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

const DEFAULT_COUNTRY: CountryCode = "US";

export function parseAllowedCountries(raw: string | undefined): CountryCode[] {
  if (!raw || raw.trim() === "") {
    return [DEFAULT_COUNTRY];
  }
  const parsed = raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length === 2) as CountryCode[];
  return parsed.length > 0 ? parsed : [DEFAULT_COUNTRY];
}

export function normalizePhone(
  input: string,
  allowedCountries: CountryCode[] = [DEFAULT_COUNTRY]
): PhoneResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, error: "Phone number is blank" };
  }

  const direct = parsePhoneNumberFromString(trimmed);
  if (direct?.isValid()) {
    const iso = direct.country;
    if (iso && allowedCountries.length > 0 && !allowedCountries.includes(iso)) {
      return { ok: false, error: `Phone country ${iso} is not in the allowlist` };
    }
    return { ok: true, e164: direct.number };
  }

  for (const country of allowedCountries) {
    const national = parsePhoneNumberFromString(trimmed, country);
    if (national?.isValid()) {
      return { ok: true, e164: national.number };
    }
  }

  return { ok: false, error: "Phone number is not a valid E.164-compatible number" };
}
