import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch();
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const suffix = process.argv[2] ?? "iter";

const fixture = {
  id: "p-visual",
  sessionId: "s-visual",
  status: "pending_review",
  kind: "connected",
  leadId: "L-100",
  campaignId: "visual",
  contactName: "Alex Rivera",
  transportOutcome: "completed",
  semanticOutcome: "permission_to_follow_up",
  qualification: "unknown",
  qualificationReason: "Need a follow-up",
  criteria: [
    {
      id: "relevant_problem",
      prompt: "Problem?",
      state: "yes",
      evidence: "we currently verify user-facing behavior by hand",
      confidence: 0.8
    }
  ],
  painOrResearchFindings: [],
  objections: [],
  nextStep: "Send a hold",
  followUpAt: null,
  summary: "Contact described a manual verification workflow and asked for a short follow-up next week.",
  callerCommitments: [],
  contactCommitments: [],
  transcriptComplete: true,
  confidence: 0.8,
  warnings: [],
  proposedFields: { call_status: "Completed", next_step: "Send a hold" },
  diff: [
    { key: "call_status", header: "Call Status", current: "Ready", proposed: "Completed", changed: true },
    { key: "next_step", header: "Next step", current: "", proposed: "Send a hold", changed: true }
  ],
  lastError: null,
  utterances: [
    { speaker: "contact", text: "we currently verify user-facing behavior by hand", seq: 1 },
    { speaker: "contact", text: "the misses still hurt every week", seq: 2 }
  ],
  coachingReplay: []
};

async function shot(page, file) {
  await page.waitForTimeout(200);
  await page.screenshot({ path: `test-results/${file}`, fullPage: false });
  console.log("wrote", file);
}

async function stubProposal(page) {
  await page.route("**/proposal", async (route) => {
    if (!route.request().url().includes("/api/calls/")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture)
    });
  });
  await page.route("**/review/interview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        text: "If you skip the follow-up, the Sheet stays Ready and nothing is written.",
        proposal: fixture,
        wrote: false,
        leftReview: false,
        lead: null,
        leads: [],
        sheet: null
      })
    });
  });
}

const desktop = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await desktop.route("**/api/bootstrap", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await route.continue();
});
await desktop.goto(`${base}/calls/s-visual/review`, { waitUntil: "commit", timeout: 15000 });
await desktop.getByLabel("Loading review…").waitFor({ timeout: 4000 }).catch(() => {});
await shot(desktop, `review-chat-skeleton-${suffix}-1280.png`);
await desktop.close();

const loaded = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await stubProposal(loaded);
await loaded.goto(`${base}/calls/s-visual/review`, { waitUntil: "load", timeout: 20000 });
await loaded.getByLabel("Review chat").waitFor({ timeout: 15000 });
await loaded.getByRole("button", { name: "Write this update" }).waitFor();
await shot(loaded, `review-chat-${suffix}-1280.png`);
await loaded.getByLabel("Review message").fill("What would change if we skip the follow-up?");
await shot(loaded, `review-chat-typed-${suffix}-1280.png`);
await loaded.getByRole("button", { name: "Send" }).click();
await loaded.getByText("If you skip the follow-up").waitFor({ timeout: 10000 });
await shot(loaded, `review-chat-bubbles-${suffix}-1280.png`);

const narrow = await browser.newPage({ viewport: { width: 768, height: 960 } });
await stubProposal(narrow);
await narrow.goto(`${base}/calls/s-visual/review`, { waitUntil: "load", timeout: 20000 });
await narrow.getByLabel("Review chat").waitFor({ timeout: 15000 });
await shot(narrow, `review-chat-${suffix}-768.png`);

const fromNotes = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await fromNotes.goto(`${base}/notifications`, { waitUntil: "load", timeout: 20000 });
const open = fromNotes.getByRole("link", { name: "Open review" }).first();
if (await open.count()) {
  await stubProposal(fromNotes);
  await open.click();
  await fromNotes.getByLabel("Review chat").waitFor({ timeout: 15000 });
  await shot(fromNotes, `review-chat-from-notifications-${suffix}-1280.png`);
} else {
  console.log("notifications has no Open review — skipped entry shot");
}

await browser.close();
