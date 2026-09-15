import { describe, expect, it } from "vitest";
import { parseTheme, prefersDark, resolveTheme } from "../../src/client/theme.js";

describe("theme", () => {
  it("accepts only light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it("defaults to light when the environment has no matchMedia", () => {
    expect(prefersDark()).toBe(false);
    expect(resolveTheme()).toBe("light");
  });
});
