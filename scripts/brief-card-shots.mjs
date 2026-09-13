import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

mkdirSync("test-results", { recursive: true });
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function box(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor({ timeout: 20_000 });
  return el.boundingBox();
}

async function shot(page, file) {
  await page.screenshot({ path: `test-results/${file}`, fullPage: false });
  console.log("wrote", file);
}

const browser = await chromium.launch();

const loading = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await loading.route("**/prepare", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 120_000));
  await route.abort();
});
await loading.goto(`${base}/leads`, { waitUntil: "domcontentloaded" });
await loading.getByRole("button", { name: "Call", exact: true }).waitFor({ timeout: 30_000 });
await loading.getByLabel("Preparing opening").waitFor({ timeout: 10_000 });
const homeLoadingCard = await box(loading, '[aria-label="Next contact"]');
const homeLoadingBrief = await box(loading, '[data-brief-state]');
const homeLoadingState = await loading.locator("[data-brief-state]").first().getAttribute("data-brief-state");
await shot(loading, "brief-card-loading.png");

const leadLink = loading.getByRole("link", { name: /Open / }).first();
if (await leadLink.count()) {
  await leadLink.click();
  await loading.getByLabel("AI prospect brief").waitFor({ timeout: 20_000 });
  const detailLoadingCard = await box(loading, '[aria-label="Next contact"]');
  const detailLoadingBrief = await box(loading, '[aria-label="AI prospect brief"]');
  const detailLoadingState = await loading
    .locator('[aria-label="AI prospect brief"]')
    .first()
    .getAttribute("data-brief-state");
  await shot(loading, "brief-card-detail-loading.png");
  console.log(
    JSON.stringify({
      homeLoadingCard,
      homeLoadingBrief,
      homeLoadingState,
      detailLoadingCard,
      detailLoadingBrief,
      detailLoadingState
    })
  );
} else {
  console.log(JSON.stringify({ homeLoadingCard, homeLoadingBrief, homeLoadingState }));
}
await loading.close();

const loaded = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await loaded.goto(`${base}/leads`, { waitUntil: "domcontentloaded" });
await loaded.getByRole("button", { name: "Call", exact: true }).waitFor({ timeout: 30_000 });
await loaded.locator('[data-brief-state="ready"]').first().waitFor({ timeout: 90_000 });
const homeLoadedCard = await box(loaded, '[aria-label="Next contact"]');
const homeLoadedBrief = await box(loaded, "[data-brief-state]");
const homeLoadedState = await loaded.locator("[data-brief-state]").first().getAttribute("data-brief-state");
await shot(loaded, "brief-card-loaded.png");

const loadedLead = loaded.getByRole("link", { name: /Open / }).first();
if (await loadedLead.count()) {
  await loadedLead.click();
  await loaded.locator('[aria-label="AI prospect brief"][data-brief-state="ready"]').waitFor({ timeout: 90_000 });
  const detailLoadedCard = await box(loaded, '[aria-label="Next contact"]');
  const detailLoadedBrief = await box(loaded, '[aria-label="AI prospect brief"]');
  await shot(loaded, "brief-card-detail-loaded.png");
  console.log(JSON.stringify({ homeLoadedCard, homeLoadedBrief, homeLoadedState, detailLoadedCard, detailLoadedBrief }));
} else {
  console.log(JSON.stringify({ homeLoadedCard, homeLoadedBrief, homeLoadedState }));
}

await browser.close();
