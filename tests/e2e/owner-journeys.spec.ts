import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// Mesmo arquivo que o webServer do playwright.config usa em MAGIC_LINK_CAPTURE_FILE.
const capturePath = path.resolve("tests/e2e/.auth/magic-link-runtime.txt");
const meta = JSON.parse(readFileSync(path.resolve("tests/e2e/.auth/meta.json"), "utf8")) as { ownerEmail: string };

async function capturedLink(email: string) {
  let link = "";
  await expect.poll(() => {
    try {
      const [to, url] = readFileSync(capturePath, "utf8").trim().split("\n");
      link = to === email ? url : "";
    } catch { link = ""; }
    return link;
  }, { timeout: 15_000 }).toMatch(/^http/);
  return link;
}

async function requestLink(page: Page, email: string) {
  await page.getByLabel("E-mail profissional").fill(email);
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toBeVisible();
  return capturedLink(email);
}

// O arquivo de captura é único: as jornadas que pedem link rodam em série.
test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });

test("login único: /login → link mágico → /dashboard; link reutilizado volta ao /login com aviso", async ({ page, browser }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  const link = await requestLink(page, meta.ownerEmail);
  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Agenda de Negócio E2E A" })).toBeVisible();

  // Já autenticado, /login devolve ao painel.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);

  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const reused = await other.newPage();
  await reused.goto(link);
  await expect(reused).toHaveURL(/\/login\?error=/);
  await expect(reused.getByRole("alert")).toContainText("expirou ou já foi usado");
  await other.close();
});

test("cadastro concluído → \"Ir para o painel\" abre /dashboard com o negócio novo", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const slug = `e2e-novo-${id}`;
  const email = `e2e-novo-${id}@example.com`;
  const name = `Estúdio Novo ${id}`;

  await page.goto("/onboarding");
  await page.locator("#business-name").fill(name);
  await page.locator("#business-slug").fill(slug);
  await page.locator('button[type="submit"]').click();
  await page.locator("#service-name").fill("Corte novo");
  await page.locator('button[type="submit"]').click();
  await page.locator('button[type="submit"]').click();
  await page.locator("#account-email").fill(email);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Verifique seu e-mail")).toBeVisible();

  await page.goto(await capturedLink(email));
  await expect(page).toHaveURL(/\/onboarding\/concluir$/);
  await expect(page.getByRole("heading", { name: "Sua agenda está no ar" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`/${slug}`)).toBeVisible();

  await page.getByRole("link", { name: "Ir para o painel" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: `Agenda de ${name}` })).toBeVisible();

  await page.goto("/dashboard/services");
  await expect(page.getByRole("heading", { name: "Corte novo" })).toBeVisible();

  const publicPage = await page.request.get(`/${slug}`);
  expect(publicPage.status()).toBe(200);
});
