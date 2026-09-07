import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { startE2eServer, TEST_PASSWORD } from "./server.js";
import { fakeResearch, prospectBrief, strategy } from "../helpers/campaigns.js";

async function fillOffering(page: Page, name: string, tag = "") {
  await page.getByLabel("Product or service", { exact: true }).fill(name);
  await page.getByLabel("What does it do, and what problem does it address?").fill(`${name} helps teams improve their workflow.`);
  await page.getByLabel("Target customers and roles").fill("Team leaders in service businesses");
  await page.getByLabel("Desired outcome of the call").fill("Understand the problem and agree on a relevant next step");
  await page.getByLabel("Approved product facts", { exact: false }).fill("Organizes the team's workflow in one place.");
  await page.getByLabel("Sheet campaign tag", { exact: false }).fill(tag);
}

test("create different offerings, assign leads, view cited preparation, switch and regenerate", async ({ page }) => {
  const server = await startE2eServer({ initialCampaigns: [], enqueueLlm: false, researchClient: fakeResearch });
  try {
    await page.goto(server.baseURL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Create a campaign" })).toBeVisible();
    await expect(page.getByRole("option", { name: /Lamina/i })).toHaveCount(0);

    server.llm.enqueueJson(strategy("Invoice collections"));
    server.llm.enqueueJson(prospectBrief());
    await fillOffering(page, "Invoice assistant", "lamina-sales");
    await page.getByRole("button", { name: "Generate campaign", exact: true }).click();
    await expect(page.getByLabel("AI prospect brief")).toContainText("invoice follow-up");
    await expect(page.getByLabel("AI prospect brief").getByRole("link", { name: "[1]", exact: true })).toHaveAttribute("href", "https://example.com/company");
    await expect(page.getByRole("button", { name: "Call", exact: true })).toBeEnabled();
    await page.screenshot({ path: "test-results/ai-campaigns-desktop.png", fullPage: true });

    await page.getByRole("button", { name: "New campaign", exact: true }).click();
    server.llm.enqueueJson(strategy("Security awareness"));
    await fillOffering(page, "Security training");
    await page.getByRole("button", { name: "Generate campaign", exact: true }).click();
    await expect(page.getByText("No eligible lead is assigned to this campaign.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Call", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Assign leads", exact: true }).click();
    const securityBrief = prospectBrief();
    securityBrief.opening = "Alex, how does Northwind QA prepare staff to recognize security risks?";
    securityBrief.questions[0]!.prompt = "How do you train staff to recognize phishing?";
    server.llm.enqueueJson(securityBrief);
    await page.getByRole("checkbox", { name: /Alex Rivera/ }).check();
    await expect(page.getByLabel("AI prospect brief")).toContainText("recognize phishing");
    await page.getByRole("button", { name: "Close lead assignment" }).click();
    await page.getByLabel("Campaign", { exact: true }).selectOption({ label: "Invoice collections" });
    await expect(page.getByLabel("AI prospect brief")).toContainText("invoice follow-up");
    await expect(page.getByLabel("AI prospect brief")).not.toContainText("recognize phishing");

    await page.getByRole("button", { name: "Edit offering" }).click();
    await page.getByLabel("Desired outcome of the call").fill("Learn about overdue collections and suggest a workflow review");
    server.llm.enqueueJson(strategy("Receivables workflow"));
    const regenerated = prospectBrief();
    regenerated.questions[0]!.prompt = "What slows down collecting overdue invoices?";
    server.llm.enqueueJson(regenerated);
    await page.getByRole("button", { name: "Save & regenerate" }).click();
    await expect(page.getByLabel("AI prospect brief")).toContainText("collecting overdue invoices");
    await expect(page.getByText(/Strategy v2/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/ai-campaigns-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("button", { name: "Call", exact: true }).click();
    await expect(page.getByLabel("Call state connecting")).toBeVisible();
    await page.getByText("Research & call preparation", { exact: true }).click();
    await expect(page.getByLabel("AI prospect brief")).toContainText("collecting overdue invoices");
  } finally { await server.close(); }
});

test("generation failures retain the offering input and retry creates an AI campaign", async ({ page }) => {
  const server = await startE2eServer({ initialCampaigns: [], enqueueLlm: false, researchClient: null });
  try {
    await page.goto(server.baseURL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
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
