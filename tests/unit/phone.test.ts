import { describe, expect, it } from "vitest";
import { normalizePhone, parseAllowedCountries } from "../../src/shared/phone.js";

describe("normalizePhone", () => {
  it("accepts E.164 numbers", () => {
    expect(normalizePhone("+14155550100")).toEqual({ ok: true, e164: "+14155550100" });
  });

  it("accepts US national numbers when US is allowed", () => {
    expect(normalizePhone("415-555-0100", parseAllowedCountries("US"))).toEqual({
      ok: true,
      e164: "+14155550100"
    });
  });

  it("rejects blank numbers", () => {
    expect(normalizePhone("   ")).toEqual({ ok: false, error: "Phone number is blank" });
  });

  it("rejects invalid numbers", () => {
    const result = normalizePhone("not-a-phone");
    expect(result.ok).toBe(false);
  });

  it("rejects numbers outside the country allowlist", () => {
    const result = normalizePhone("+442071838750", parseAllowedCountries("US"));
    expect(result.ok).toBe(false);
  });
});
