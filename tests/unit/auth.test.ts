import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/server/auth/password.js";
import { createSessionToken, readSessionToken } from "../../src/server/auth/session.js";
import { credentialsSchema } from "../../src/shared/schemas.js";

describe("session tokens", () => {
  const secret = "test-session-secret-32-characters-min";

  it("round-trips a user id until expiry", () => {
    const now = 1_700_000_000_000;
    const token = createSessionToken(secret, "user-1", now);
    expect(readSessionToken(secret, token, now + 1000)).toBe("user-1");
    expect(readSessionToken(secret, token, now + 12 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken(secret, "user-1");
    expect(readSessionToken(secret, `${token}x`)).toBeNull();
    expect(readSessionToken("other-session-secret-32-characters", token)).toBeNull();
  });
});

describe("passwords", () => {
  it("verifies a scrypt hash", async () => {
    const stored = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", stored)).toBe(true);
    expect(await verifyPassword("wrong-horse", stored)).toBe(false);
  });
});

describe("credentials schema", () => {
  it("normalizes email and requires an 8-character password", () => {
    expect(credentialsSchema.parse({ email: "  Ops@Test.Local ", password: "password1" })).toEqual({
      email: "ops@test.local",
      password: "password1"
    });
    expect(credentialsSchema.safeParse({ email: "ops@test.local", password: "short" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: "not-an-email", password: "password1" }).success).toBe(false);
  });
});
