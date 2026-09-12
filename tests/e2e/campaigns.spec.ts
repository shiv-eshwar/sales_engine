import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { startE2eServer } from "./server.js";
import { fakeResearch, prospectBrief, strategy } from "../helpers/campaigns.js";

async function fillOffering(page: Page, name: string, tag = "") {
  await page.getByLabel("Product or service", { exact: true }).fill(name);
  await page.getByLabel("What does it do, and what problem does it address?").fill(`${name} helps teams improve their workflow.`);
  await page.getByLabel("Target customers and roles").fill("Team leaders in service businesses");
  await page.getByLabel("Desired outcome of the call").fill("Understand the problem and agree on a relevant next step");
  await page.getByLabel("Approved product facts", { exact: false }).fill("Organizes the team's workflow in one place.");
  await page.getByLabel("Sheet campaign tag", { exact: false }).fill(tag);
}

async function openCampaignForm(page: Page, label: "Create a campaign" | "New campaign" = "Create a campaign") {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page.getByLabel("Product or service", { exact: true })).toBeVisible();
}

async function openPrep(page: Page) {
  const brief = page.getByLabel("AI prospect brief");
  if (await brief.isVisible()) return;
  await page.getByText("Prep", { exact: true }).first().click();
  await expect(brief).toBeVisible();
}

async function openFirstLead(page: Page) {
  await expect(page.getByRole("table", { name: "Leads" })).toContainText("Alex Rivera");
  await page.getByRole("link", { name: /Open Alex Rivera/ }).first().click();
  await expect(page.getByRole("heading", { name: "Alex Rivera" })).toBeVisible();
}

test("create different offerings, match leads by sheet tag, view cited preparation, switch and regenerate", async ({ page }) => {
  const server = await startE2eServer({ initialCampaigns: [], enqueueLlm: false, researchClient: fakeResearch });
  try {
    await page.goto(server.baseURL);
    await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a campaign" }).first()).toBeVisible();
    await expect(page.getByRole("option", { name: /Lamina/i })).toHaveCount(0);

    server.llm.enqueueJson(strategy("Invoice collections"));
    server.llm.enqueueJson(prospectBrief());
    await openCampaignForm(page);
    await fillOffering(page, "Invoice assistant", "lamina-sales");
    await page.getByRole("button", { name: "Generate campaign", exact: true }).click();
    await openFirstLead(page);
    await openPrep(page);
    await expect(page.getByLabel("AI prospect brief")).toContainText("invoice follow-up");
    await expect(page.getByLabel("AI prospect brief").getByRole("link", { name: "[1]", exact: true })).toHaveAttribute("href", "https://example.com/company");
    await expect(page.getByRole("button", { name: "Call", exact: true })).toBeEnabled();
    await page.screenshot({ path: "test-results/ai-campaigns-desktop.png", fullPage: true });

    await page.getByRole("link", { name: "Back to ready" }).click();
    await expect(page.getByRole("table", { name: "Leads" })).toBeVisible();
    await page.getByRole("button", { name: "New campaign", exact: true }).click();
    server.llm.enqueueJson(strategy("Security awareness"));
    const securityBrief = prospectBrief();
    securityBrief.opening = "Alex, how does Northwind QA prepare staff to recognize security risks?";
    securityBrief.questions[0]!.prompt = "How do you train staff to recognize phishing?";
    server.llm.enqueueJson(securityBrief);
    await fillOffering(page, "Security training", "lamina-sales");
    await page.getByRole("button", { name: "Generate campaign", exact: true }).click();
    await openFirstLead(page);
    await openPrep(page);
    await expect(page.getByLabel("AI prospect brief")).toContainText("recognize phishing");
    await page.getByRole("link", { name: "Back to ready" }).click();
    await page.getByLabel("Campaign", { exact: true }).selectOption({ label: "Invoice collections" });
    await openFirstLead(page);
    await openPrep(page);
    await expect(page.getByLabel("AI prospect brief")).toContainText("invoice follow-up");
    await expect(page.getByLabel("AI prospect brief")).not.toContainText("recognize phishing");

    await page.getByRole("link", { name: "Back to ready" }).click();
    await page.getByRole("button", { name: "Edit offering" }).click();
    await page.getByLabel("Desired outcome of the call").fill("Learn about overdue collections and suggest a workflow review");
    server.llm.enqueueJson(strategy("Receivables workflow"));
    const regenerated = prospectBrief();
    regenerated.questions[0]!.prompt = "What slows down collecting overdue invoices?";
    server.llm.enqueueJson(regenerated);
    await page.getByRole("button", { name: "Save & regenerate" }).click();
    await openFirstLead(page);
    await openPrep(page);
    await expect(page.getByLabel("AI prospect brief")).toContainText("collecting overdue invoices");
    await expect(page.getByText(/Strategy v2/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/ai-campaigns-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("button", { name: "Call", exact: true }).click();
    await expect(page.getByLabel("Call state connecting")).toBeVisible();
    await page.getByText("Prep", { exact: true }).click();
    await expect(page.getByLabel("AI prospect brief")).toContainText("collecting overdue invoices");
  } finally { await server.close(); }
});

test("generation failures retain the offering input and retry creates an AI campaign", async ({ page }) => {
  const server = await startE2eServer({ initialCampaigns: [], enqueueLlm: false, researchClient: null });
  try {
    await page.goto(server.baseURL);
    await openCampaignForm(page);
    await fillOffering(page, "Invoice assistant");
    server.llm.enqueueRaw("invalid output");
    await page.getByRole("button", { name: "Generate campaign", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("AI generation failed");
    await expect(page.getByLabel("Product or service", { exact: true })).toHaveValue("Invoice assistant");
    server.llm.enqueueJson(strategy("Invoice collections"));
    await page.getByRole("button", { name: "Generate campaign", exact: true }).click();
    await expect(page.getByRole("option", { name: "Invoice collections", exact: true })).toHaveCount(1);
    await expect(page.getByText("Web research unavailable; preparation will use CRM context only.")).toBeVisible();
  } finally { await server.close(); }
});
