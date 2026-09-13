import { expect, test as base } from "@playwright/test";
import { startE2eServer, type E2eServer } from "./server.js";

const test = base.extend<{ server: E2eServer }>({
  server: async ({}, use) => {
    const server = await startE2eServer();
    await use(server);
    await server.close();
  }
});

async function login(page: import("@playwright/test").Page, baseURL: string) {
  await page.goto(baseURL);
  await expect(page.getByRole("link", { name: "Mantis" })).toBeVisible();
}

async function chooseCampaign(page: import("@playwright/test").Page, name: string) {
  await page.getByLabel("Campaign", { exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function openLead(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("link", { name: new RegExp(`Open ${name}`) }).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function connectLiveCall(page: import("@playwright/test").Page, server: E2eServer) {
  await expect(page.getByLabel("Twilio device registered")).toBeVisible();
  await expect(page.getByText("Alex Rivera", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Call" })).toBeEnabled();
  await page.getByRole("button", { name: "Call" }).click();
  await expect(page.getByLabel("Call state connecting")).toBeVisible();

  const media = await server.startMedia(page);
  const ringing = await server.signedPost("/twilio/voice/status", {
    sessionId: media.sessionId,
    CallSid: media.parentSid,
    CallStatus: "ringing"
  });
  expect(ringing.status).toBe(204);
  await expect(page.getByLabel("Call state ringing")).toBeVisible();

  const answered = await server.signedPost("/twilio/voice/status", {
    sessionId: media.sessionId,
    CallSid: media.parentSid,
    CallStatus: "in-progress"
  });
  expect(answered.status).toBe(204);
  await expect(page.getByLabel("Call state connected")).toBeVisible();

  const fakes = await server.waitForFakes(2);
  for (const fake of fakes) {
    fake.open();
  }
  return { ...media, inbound: fakes[0], outbound: fakes[1] };
}

test("login through approve loads the next lead", async ({ page, server }) => {
  await login(page, server.baseURL);
  await chooseCampaign(page, "Lamina founder sales");
  await expect(page.getByRole("table", { name: "Leads" })).toContainText("Alex Rivera");

  await openLead(page, "Alex Rivera");

  const live = await connectLiveCall(page, server);
  live.outbound?.emitFinal("we currently verify user-facing behavior by hand");
  await expect(page.getByLabel("Live coaching cue")).toContainText(
    "How do you currently verify user-facing behavior?"
  );
  expect(await page.getByLabel("Live coaching cue").count()).toBe(1);

  live.inbound?.emitFinal("hello from caller");
  await expect(page.getByText("Caller: hello from caller")).toBeVisible();
  await expect(page.getByText("Contact: we currently verify user-facing behavior by hand")).toBeVisible();

  live.outbound?.emitFinal("the misses still hurt every week");
  await expect(page.getByLabel("Live coaching cue")).toContainText("What does a miss cost in a typical week?");
  expect(await page.getByLabel("Live coaching cue").count()).toBe(1);

  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible();
  await page.getByRole("button", { name: "Unmute" }).click();
  await expect(page.getByRole("button", { name: "Mute" })).toBeVisible();

  await page.getByRole("button", { name: "Hang Up" }).click();
  const completed = await server.signedPost("/twilio/voice/status", {
    sessionId: live.sessionId,
    CallSid: live.parentSid,
    CallStatus: "completed"
  });
  expect(completed.status).toBe(204);

  await expect(page.getByLabel("Review chat")).toBeVisible();
  await expect(page.getByLabel("Review chat")).toContainText("Proposed");
  await expect(page.getByLabel("Review chat")).toContainText("Call Status");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Write to Sheet & next" })).toHaveCount(0);
  await page.getByRole("button", { name: "Write this update" }).click();
  await expect(page.getByRole("heading", { name: "Jordan Chen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Call" })).toBeVisible();
});

test("open a specific lead from the table, search and navigate", async ({ page, server }) => {
  await login(page, server.baseURL);
  await chooseCampaign(page, "Lamina founder sales");
  await expect(page.getByRole("table", { name: "Leads" })).toContainText("Alex Rivera");

  // Search filters the table.
  await page.getByLabel("Search leads").fill("Jordan");
  await expect(page.getByRole("table", { name: "Leads" })).toContainText("Jordan Chen");
  await expect(page.getByRole("table", { name: "Leads" })).not.toContainText("Alex Rivera");
  await page.getByLabel("Search leads").fill("");

  // Click into a lead detail page and back.
  await openLead(page, "Jordan Chen");
  await expect(page).toHaveURL(/\/leads\/L-101/);
  await expect(page.getByRole("heading", { name: "Jordan Chen" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
  await page.getByRole("link", { name: "Mantis" }).click();
  await expect(page.getByRole("table", { name: "Leads" })).toBeVisible();

  await openLead(page, "Alex Rivera");
  await expect(page).toHaveURL(/\/leads\/L-100/);
});

test("Deepgram drop shows interruption while Mute and Hang Up stay enabled", async ({ page, server }) => {
  await login(page, server.baseURL);
  await chooseCampaign(page, "Lamina founder sales");
  await openLead(page, "Alex Rivera");
  const live = await connectLiveCall(page, server);
  live.outbound?.fail(new Error("deepgram drop"));
  await expect(page.getByText("Transcription interrupted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Hang Up" })).toBeEnabled();
});

const invalidSheet = base.extend<{ server: E2eServer }>({
  server: async ({}, use) => {
    const server = await startE2eServer({
      sheetsConfigPath: "./tests/e2e/fixtures/sheets-invalid.yaml",
      enqueueLlm: false
    });
    await use(server);
    await server.close();
  }
});

test("notifications lists queue issues and replaces diagnostics nav", async ({ page, server }) => {
  await login(page, server.baseURL);
  await chooseCampaign(page, "Lamina founder sales");
  await expect(page.getByRole("link", { name: /Queue diagnostics/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Notifications, 3 waiting/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New campaign" })).toBeVisible();
  await page.getByRole("link", { name: /need a phone fix/ }).click();
  await expect(page).toHaveURL(/\/notifications#queue/);
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
  await expect(page.getByText("Sam Patel")).toBeVisible();
  await expect(page.getByText("Can't be dialed")).toBeVisible();
  await expect(page.getByText("Blank ID")).toBeVisible();
  await page.goto(`${server.baseURL}/diagnostics`);
  await expect(page).toHaveURL(/\/notifications#queue/);
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
});

invalidSheet("invalid Sheet headers block Call", async ({ page, server }) => {
  await login(page, server.baseURL);
  await expect(page.getByLabel("Sheet blocking error")).toBeVisible();
  await expect(page.getByLabel("Sheet blocking error")).toContainText("Sheet needs a fix");
});
