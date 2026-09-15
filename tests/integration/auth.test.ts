import { describe, expect, it } from "vitest";
import { loginCookie, startTestApp, TEST_EMAIL, TEST_PASSWORD } from "../helpers/app.js";

describe("email/password auth", () => {
  it("rejects API access without a session cookie", async () => {
    const { app } = await startTestApp();
    const response = await app.inject({ url: "/api/bootstrap" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Sign in required" });
    await app.close();
  });

  it("signs up, signs in, and exposes the operator email", async () => {
    const { app } = await startTestApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: "caller@example.com", password: "password1" }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual({ ok: true, email: "caller@example.com" });
    const cookie = created.headers["set-cookie"];
    expect(cookie).toBeTruthy();
    const raw = Array.isArray(cookie) ? cookie[0] : cookie;
    const header = raw!.split(";")[0] ?? raw!;
    const session = await app.inject({ url: "/api/session", headers: { cookie: header } });
    expect(session.json()).toEqual({ authenticated: true, email: "caller@example.com" });
    const bootstrap = await app.inject({ url: "/api/bootstrap", headers: { cookie: header } });
    expect(bootstrap.statusCode).toBe(200);
    expect(bootstrap.json().operator).toEqual({ email: "caller@example.com" });
    await app.close();
  });

  it("rejects a duplicate email and a bad password", async () => {
    const { app } = await startTestApp();
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: TEST_EMAIL, password: "password1" }
    });
    expect(duplicate.statusCode).toBe(409);
    const denied = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { email: TEST_EMAIL, password: "wrong-password" }
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toEqual({ error: "Invalid email or password" });
    const unknown = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { email: "nobody@test.local", password: "password1" }
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json()).toEqual({ error: "Invalid email or password" });
    const cookie = await loginCookie(app);
    const loggedOut = await app.inject({ method: "POST", url: "/api/logout", headers: { cookie } });
    expect(loggedOut.statusCode).toBe(200);
    const cleared = loggedOut.headers["set-cookie"];
    const clearedHeader = String(Array.isArray(cleared) ? cleared[0] : cleared);
    expect(clearedHeader.toLowerCase()).toContain("httponly");
    expect(clearedHeader.toLowerCase()).toContain("samesite=lax");
    expect(clearedHeader).toMatch(/Max-Age=0/i);
    expect((await app.inject({ url: "/api/bootstrap" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/session" })).json()).toEqual({ authenticated: false, email: null });
    await app.close();
  });

  it("clears the session cookie with Secure on HTTPS origins", async () => {
    const { app } = await startTestApp({ APP_BASE_URL: "https://mantis.example" });
    const cookie = await loginCookie(app);
    const loggedOut = await app.inject({ method: "POST", url: "/api/logout", headers: { cookie } });
    const cleared = loggedOut.headers["set-cookie"];
    const clearedHeader = String(Array.isArray(cleared) ? cleared[0] : cleared);
    expect(clearedHeader.toLowerCase()).toContain("secure");
    expect(clearedHeader.toLowerCase()).toContain("httponly");
    expect(clearedHeader.toLowerCase()).toContain("samesite=lax");
    await app.close();
  });

  it("reports session signing as a ready check", async () => {
    const { app } = await startTestApp();
    const ready = await app.inject({ url: "/health/ready" });
    expect(ready.json().checks.auth).toEqual({
      ok: true,
      message: "Email/password accounts; session cookie required"
    });
    await app.close();
  });

  it("does not treat TEST_PASSWORD as a shared app password", async () => {
    const { app } = await startTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { password: TEST_PASSWORD }
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
