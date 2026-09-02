import { expect, test as base } from "@playwright/test";
import { startE2eServer, TEST_PASSWORD, type E2eServer } from "./server.js";

const test = base.extend<{ server: E2eServer }>({
  server: async ({}, use) => {
    const server = await startE2eServer();
    await use(server);
    await server.close();
  }
});

async function login(page: import("@playwright/test").Page, baseURL: string) {
  await page.goto(baseURL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Ready to call" })).toBeVisible();
}

async function connectLiveCall(page: import("@playwright/test").Page, server: E2eServer) {
  await expect(page.getByLabel("Twilio device registered")).toBeVisible();
  await expect(page.getByText("Alex Rivera")).toBeVisible();
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
  await expect(page.getByText("Alex Rivera")).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Ready to call" })).toBeVisible();
  await expect(page.getByText("Jordan Chen")).toBeVisible();
  await expect(page.getByText("Blue Harbor")).toBeVisible();
});

test("Deepgram drop shows interruption while Mute and Hang Up stay enabled", async ({ page, server }) => {
  await login(page, server.baseURL);
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
  await expect(page.getByLabel("Sheet blocking error")).toContainText("Phone Number");
  await expect(page.getByRole("button", { name: "Call" })).toHaveCount(0);
});
