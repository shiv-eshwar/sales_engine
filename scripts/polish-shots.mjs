import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch();
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const suffix = process.argv[2] ?? "iter";

async function shot(path, file, width, height, after) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Notifications|Analytics|Nothing waiting/ }).first().waitFor({ timeout: 15000 });
  if (after) await after(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${file}`, fullPage: true });
  await page.close();
  console.log("wrote", file);
}

await shot("/notifications", `notifications-polish-${suffix}-1280.png`, 1280, 860);
await shot("/notifications", `notifications-polish-${suffix}-1024.png`, 1024, 860);
await shot("/notifications", `notifications-polish-${suffix}-768.png`, 768, 960);
await shot("/analytics", `analytics-polish-${suffix}-1280.png`, 1280, 860);
await shot("/analytics", `analytics-polish-${suffix}-1024.png`, 1024, 860);
await shot("/analytics", `analytics-polish-${suffix}-768.png`, 768, 960);
await shot("/analytics", `analytics-polish-${suffix}-campaign-1280.png`, 1280, 860, async (page) => {
  const filter = page.getByLabel("Filter campaign");
  await filter.click();
  const option = page.getByRole("option").nth(1);
  if (await option.count()) {
    await option.click();
    await page.getByRole("heading", { name: "Analytics" }).waitFor();
    await page.waitForTimeout(400);
  }
});
await browser.close();
