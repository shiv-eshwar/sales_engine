import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/index.js";
import { loginCookie, startTestApp } from "../helpers/app.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("campaign Sheet connect", () => {
  it("exposes sheet binding on bootstrap", async () => {
    const { app } = await startTestApp();
    apps.push(app);
    const cookie = await loginCookie(app);
    const body = (await app.inject({ url: "/api/bootstrap", headers: { cookie } })).json();
    expect(body.sheet.status).toBe("ok");
    expect(body.sheet.backend).toBe("memory");
    expect(body.sheet.manageable).toBe(false);
    expect(body.sheet.spreadsheetId).toBe("configured-outside-source-control");
  });

  it("does not create or link Google Sheets on the memory backend", async () => {
    const { app } = await startTestApp();
    apps.push(app);
    const cookie = await loginCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/sheets/create",
      headers: { cookie },
      payload: { title: "Pipeline" }
    });
    expect(created.statusCode).toBe(409);
    const linked = await app.inject({
      method: "POST",
      url: "/api/sheets/link",
      headers: { cookie },
      payload: { spreadsheet: "https://docs.google.com/spreadsheets/d/1abcDEFGHIJKLMNOPQRST/edit" }
    });
    expect(linked.statusCode).toBe(409);
  });

  it("rejects an unreadable spreadsheet reference", async () => {
    const { app } = await startTestApp({
      SHEETS_BACKEND: "google",
      GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(JSON.stringify({ type: "service_account", client_email: "sa@test.iam.gserviceaccount.com" })).toString("base64")
    });
    apps.push(app);
    const cookie = await loginCookie(app);
    const linked = await app.inject({
      method: "POST",
      url: "/api/sheets/link",
      headers: { cookie },
      payload: { spreadsheet: "nope" }
    });
    expect(linked.statusCode).toBe(400);
  });
});
