import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/index.js";
import { loginCookie, startTestApp, bindSampleSheet } from "../helpers/app.js";
import { FakeLlmClient } from "../helpers/llm.js";
import { offering, strategy } from "../helpers/campaigns.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("campaign Sheet connect", () => {
  it("exposes the selected campaign's Sheet on bootstrap", async () => {
    const { app } = await startTestApp();
    apps.push(app);
    const cookie = await loginCookie(app);
    const body = (await app.inject({ url: "/api/bootstrap", headers: { cookie } })).json();
    expect(body.sheet.status).toBe("ok");
    expect(body.sheet.backend).toBe("memory");
    expect(body.sheet.manageable).toBe(false);
    expect(body.sheet.spreadsheetId).toBe("memory:lamina-sales");
  });

  it("creates a unique sample Sheet per campaign request on the memory backend", async () => {
    const { app } = await startTestApp({}, { initialCampaigns: [] });
    apps.push(app);
    const cookie = await loginCookie(app);
    const first = await app.inject({
      method: "POST",
      url: "/api/sheets/create",
      headers: { cookie },
      payload: { title: "Pipeline", requestId: randomUUID() }
    });
    expect(first.statusCode, first.body).toBe(200);
    const second = await app.inject({
      method: "POST",
      url: "/api/sheets/create",
      headers: { cookie },
      payload: { title: "Other pipeline", requestId: randomUUID() }
    });
    expect(second.statusCode, second.body).toBe(200);
    expect(second.json().spreadsheetId).not.toBe(first.json().spreadsheetId);
  });

  it("does not let two saved campaigns share a spreadsheet", async () => {
    const llm = new FakeLlmClient();
    const { app } = await startTestApp({}, { initialCampaigns: [], llmClient: llm });
    apps.push(app);
    const cookie = await loginCookie(app);
    const requestId = randomUUID();
    const bound = await bindSampleSheet(app, cookie, requestId);
    llm.enqueueJson(strategy("Collections"));
    const created = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      headers: { cookie },
      payload: { requestId, brief: offering("Collections") }
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().spreadsheetId).toBe(bound.spreadsheetId);
    const reused = await app.inject({
      method: "POST",
      url: "/api/sheets/link",
      headers: { cookie },
      payload: { spreadsheet: bound.spreadsheetId, requestId: randomUUID() }
    });
    expect(reused.statusCode).toBe(409);
    expect(reused.json().error).toMatch(/already attached/i);
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
      payload: { spreadsheet: "nope", requestId: randomUUID() }
    });
    expect(linked.statusCode).toBe(400);
  });
});
