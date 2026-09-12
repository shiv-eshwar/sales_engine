import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { startE2eServer } from "./server.js";
import { fakeResearch, interviewTurn, offering, prospectBrief, strategy } from "../helpers/campaigns.js";

function offeringMessage(name: string, tag = "") {
  return [
    `${name}.`,
    `${name} helps teams improve their workflow.`,
    "Target customers: Team leaders in service businesses.",
    "Desired outcome: Understand the problem and agree on a relevant next step.",
    "Approved product fact: Organizes the team's workflow in one place.",
    tag ? `Sheet campaign tag: ${tag}.` : ""
  ].filter(Boolean).join(" ");
}

async function openCampaignChat(page: Page, label: "Create a campaign" | "New campaign" = "Create a campaign") {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connect a leads Sheet" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with this Sheet", exact: true }).click();
  await expect(page.getByLabel("Campaign chat")).toBeVisible();
  await expect(page.getByLabel("Campaign message")).toBeVisible();
}

async function sendCampaignChat(page: Page, text: string) {
  await page.getByLabel("Campaign message").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
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
    await expect(page.getByRole("link", { name: "Ready" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a campaign" }).first()).toBeVisible();
    await expect(page.getByLabel("Campaign", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New campaign", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: /Lamina/i })).toHaveCount(0);

    server.llm.enqueueJson(interviewTurn({ ...offering("Invoice assistant"), sheetCampaignValue: "lamina-sales" }));
    server.llm.enqueueJson(strategy("Invoice collections"));
    server.llm.enqueueJson(prospectBrief());
    await openCampaignChat(page);
    await sendCampaignChat(page, offeringMessage("Invoice assistant", "lamina-sales"));
    await openFirstLead(page);
    await openPrep(page);
    await expect(page.getByLabel("AI prospect brief")).toContainText("invoice follow-up");
    await expect(page.getByLabel("AI prospect brief").getByRole("link", { name: "[1]", exact: true })).toHaveAttribute("href", "https://example.com/company");
    await expect(page.getByRole("button", { name: "Call", exact: true })).toBeEnabled();
    await page.screenshot({ path: "test-results/ai-campaigns-desktop.png", fullPage: true });

    await page.getByRole("link", { name: "Back to ready" }).click();
    await expect(page.getByRole("table", { name: "Leads" })).toBeVisible();
    await openCampaignChat(page, "New campaign");
    server.llm.enqueueJson(interviewTurn({ ...offering("Security training"), sheetCampaignValue: "lamina-sales" }));
    server.llm.enqueueJson(strategy("Security awareness"));
    const securityBrief = prospectBrief();
    securityBrief.opening = "Alex, how does Northwind QA prepare staff to recognize security risks?";
    securityBrief.questions[0]!.prompt = "How do you train staff to recognize phishing?";
    server.llm.enqueueJson(securityBrief);
    await sendCampaignChat(page, offeringMessage("Security training", "lamina-sales"));
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
    await expect(page.getByLabel("Campaign chat")).toBeVisible();
    server.llm.enqueueJson(interviewTurn({
      ...offering("Invoice assistant"),
      sheetCampaignValue: "lamina-sales",
      objective: "Learn about overdue collections and suggest a workflow review"
    }));
    server.llm.enqueueJson(strategy("Receivables workflow"));
    const regenerated = prospectBrief();
    regenerated.questions[0]!.prompt = "What slows down collecting overdue invoices?";
    server.llm.enqueueJson(regenerated);
    await sendCampaignChat(page, "Change the desired outcome to: Learn about overdue collections and suggest a workflow review");
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
    await openCampaignChat(page);
    server.llm.enqueueRaw("invalid output");
    await sendCampaignChat(page, offeringMessage("Invoice assistant"));
    await expect(page.getByRole("alert")).toContainText("AI generation failed");
    await expect(page.getByLabel("Campaign chat")).toContainText("Invoice assistant");
    server.llm.enqueueJson(interviewTurn(offering("Invoice assistant")));
    server.llm.enqueueJson(strategy("Invoice collections"));
    await sendCampaignChat(page, "Please try again.");
    await expect(page.getByRole("option", { name: "Invoice collections", exact: true })).toHaveCount(1);
    await expect(page.getByText("Web research unavailable; preparation will use CRM context only.")).toBeVisible();
  } finally { await server.close(); }
});
