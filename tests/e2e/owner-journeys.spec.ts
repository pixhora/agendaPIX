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

/** O e-mail abre a página de confirmação. O botão é que cria a sessão. */
async function openAccessLink(page: Page, link: string, email?: string) {
  await page.goto(link);
  const path = new URL(page.url()).pathname;
  if (path === "/entrar/confirmar") {
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    return;
  }
  if (path !== "/onboarding/confirmar") return;
  const code = page.locator("#otp-code");
  await expect.poll(async () => (await code.inputValue()).length).toBe(6);
  const emailField = page.getByLabel("E-mail");
  if (await emailField.isVisible()) {
    if (!email) throw new Error("A confirmação pediu o e-mail e o teste não passou um.");
    await emailField.fill(email);
  }
  const button = page.getByRole("button", { name: "Confirmar código" });
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
  await button.click();
}

async function continueWhenReady(page: Page) {
  const button = page.getByRole("button", { name: "Continuar" });
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
  await button.click();
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
  await openAccessLink(page, link);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Agenda de Negócio E2E A" })).toBeVisible();

  // Já autenticado, /login devolve ao painel.
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);

  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const reused = await other.newPage();
  await openAccessLink(reused, link);
  await expect(reused).toHaveURL(/\/login\?error=/);
  await expect(reused.locator("#login-error")).toContainText("expirou ou já foi usado");
  await other.close();
});

test("cadastro concluído → \"Ir para o painel\" abre /dashboard com o negócio novo", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const slug = `e2e-novo-${id}`;
  const email = `e2e-novo-${id}@example.com`;
  const name = `Estúdio Novo ${id}`;

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Nome e link da sua página" })).toBeVisible();
  await page.getByLabel("Nome do negócio").fill(name);
  await page.getByLabel("Seu link").fill(slug);
  await expect(page.getByText("Disponível. É seu!")).toBeVisible();
  await continueWhenReady(page);

  await expect(page.getByRole("heading", { name: "Seu primeiro serviço" })).toBeVisible();
  await page.getByLabel("Nome do serviço").fill("Corte novo");
  await page.getByRole("radio", { name: "45 min", exact: true }).click();
  const price = page.getByLabel("Preço do serviço em reais");
  await price.click();
  await price.pressSequentially("5000");
  await expect(price).toHaveValue(/50,00/);
  await continueWhenReady(page);

  await expect(page.getByRole("heading", { name: "Quando você atende?" })).toBeVisible();
  await continueWhenReady(page);

  await expect(page.getByRole("heading", { name: "Para onde mandamos seu código?" })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  const send = page.getByRole("button", { name: "Enviar código" });
  await expect(send).not.toHaveAttribute("aria-disabled", "true");
  await send.click();
  await expect(page.getByRole("heading", { name: "Digite o código que mandamos" })).toBeVisible();

  await openAccessLink(page, await capturedLink(email), email);
  await expect(page).toHaveURL(/\/onboarding\/concluir$/, { timeout: 20_000 });
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
