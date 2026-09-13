import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
await mkdir("test-results", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(baseURL, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Mantis" }).waitFor();

const header = page.locator("header");
await header.screenshot({ path: "test-results/navbar-icons-desktop.png" });

await page.setViewportSize({ width: 768, height: 900 });
await page.waitForTimeout(200);
await header.screenshot({ path: "test-results/navbar-icons-768.png" });

await page.setViewportSize({ width: 1280, height: 800 });

const campaign = page.getByLabel("Campaign", { exact: true });
const campaignCount = await campaign.count();
const editOffering = page.getByRole("button", { name: "Edit offering" });

const notifications = page.getByRole("link", { name: /^Notifications/ });
await notifications.click();
if (!page.url().includes("/notifications")) throw new Error("Notifications did not navigate");

await page.getByRole("link", { name: "Analytics" }).click();
if (!page.url().includes("/analytics")) throw new Error("Analytics did not navigate");

await page.getByRole("link", { name: "Mantis" }).click();
if (!page.url().includes("/leads")) throw new Error("Mantis did not return Home");

await page.getByRole("button", { name: "New campaign" }).click();
const sheetOrChat = page.getByRole("heading", { name: /Connect a leads Sheet|Create a campaign/ }).first();
await sheetOrChat.waitFor();

const badgeVisible = await page.locator(".header-icon-badge").isVisible().catch(() => false);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

console.log(
  JSON.stringify(
    {
      campaignExact: campaignCount,
      editOffering: await editOffering.count(),
      badgeVisible,
      noHorizontalOverflow: overflow,
      notificationsName: await notifications.getAttribute("aria-label")
    },
    null,
    2
  )
);

await browser.close();
