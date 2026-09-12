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
  await expect(page.getByRole("link", { name: "Sales Engine" })).toBeVisible();
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
  await page.getByLabel("Campaign").selectOption("lamina-sales");
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

  await expect(page.getByRole("heading", { name: "Review CRM update" })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Call Status");
  await expect(page.getByRole("table")).toContainText("Proposed");

  await page.getByRole("button", { name: "Approve & next" }).click();
  await expect(page.getByRole("heading", { name: "Jordan Chen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Call" })).toBeVisible();
});

test("open a specific lead from the table, search and navigate", async ({ page, server }) => {
  await login(page, server.baseURL);
  await page.getByLabel("Campaign").selectOption("lamina-sales");
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
  await page.getByRole("link", { name: "Back to ready" }).click();
  await expect(page.getByRole("table", { name: "Leads" })).toBeVisible();

  await openLead(page, "Alex Rivera");
  await expect(page).toHaveURL(/\/leads\/L-100/);
});

test("Deepgram drop shows interruption while Mute and Hang Up stay enabled", async ({ page, server }) => {
  await login(page, server.baseURL);
  await page.getByLabel("Campaign").selectOption("lamina-sales");
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

invalidSheet("invalid Sheet headers block Call", async ({ page, server }) => {
  await login(page, server.baseURL);
  await expect(page.getByLabel("Sheet blocking error")).toBeVisible();
  await expect(page.getByLabel("Sheet blocking error")).toContainText("Sheet needs a fix");
});
