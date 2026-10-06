import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { test, readMeta, ownerStorageState } from "./helpers";

const PHASE = process.env.BRAND_SHOT_PHASE === "after" ? "after" : "before";
const OUT = `/workspace/agendaPIX-screens/brand-icon/${PHASE}`;

async function shot(page: import("@playwright/test").Page, name: string) {
  const project = test.info().project.name;
  const dir = path.join(OUT, project);
  await mkdir(dir, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

const meta = readMeta();

test("landing header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Agenda/i }).first()).toBeVisible();
  await shot(page, "01-landing-header");
});

test("login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /Agenda/i }).first()).toBeVisible();
  await shot(page, "02-login");
});

test.describe("painel", () => {
  test.use({ storageState: ownerStorageState });
  test("sidebar", async ({ page }) => {
    await page.goto(`/dashboard?businessId=${meta.businessAId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, "03-painel-sidebar");
  });
});
