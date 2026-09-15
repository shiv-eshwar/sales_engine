import { expect, type Page } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "../helpers/app.js";

export async function signIn(
  page: Page,
  baseURL: string,
  credentials: { email: string; password: string } = { email: TEST_EMAIL, password: TEST_PASSWORD }
): Promise<void> {
  await page.goto(baseURL);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Mantis" })).toBeVisible();
}
