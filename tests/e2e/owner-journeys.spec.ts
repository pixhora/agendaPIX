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
const logoFile = {
  name: "logo.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
};

async function openAccessLink(page: Page, link: string, email?: string, beforeConfirm?: () => Promise<void>) {
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
  if (beforeConfirm) await beforeConfirm();
  const button = page.getByRole("button", { name: "Confirmar código" });
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
  await expect(page.getByRole("heading", { name: "Sua loja" })).toBeVisible();
  await page.getByLabel("Nome da loja").fill(name);
  await page.getByLabel("Seu link").fill(slug);
  await expect(page.getByText("Disponível", { exact: true })).toBeVisible();
  await page.getByLabel("Nome do serviço").fill("Corte novo");
  await page.getByLabel("Duração").selectOption("45");
  const price = page.getByLabel("Preço");
  await price.click();
  await price.pressSequentially("5000");
  await expect(price).toHaveValue(/50,00/);
  await page.locator("input[type=file]").setInputFiles(logoFile);
  await page.locator("#store-day-1").check();
  await page.locator("#store-open-1").fill("09:00");
  await page.locator("#store-close-1").fill("18:00");
  const proceed = page.getByRole("button", { name: "Continuar" });
  await expect(proceed).toBeEnabled();
  await proceed.click();

  await expect(page.getByRole("heading", { name: "Para onde mandamos seu código?" })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  const send = page.getByRole("button", { name: "Enviar código" });
  await expect(send).not.toHaveAttribute("aria-disabled", "true");
  const draftSent = page.waitForRequest((request) => {
    if (!request.url().includes("/api/onboarding/drafts")) return false;
    if (request.method() !== "POST" && request.method() !== "PATCH") return false;
    try {
      const body = request.postDataJSON() as { data?: { business?: unknown } };
      return Boolean(body.data?.business);
    } catch {
      return false;
    }
  }, { timeout: 20_000 });
  await send.click();
  const draftRequest = await draftSent;
  const draftBody = draftRequest.postDataJSON() as { data?: { business?: Record<string, unknown> } };
  expect(draftBody.data?.business).toBeTruthy();
  expect(draftBody.data?.business).not.toHaveProperty("logoUrl");
  await expect(page.getByRole("heading", { name: "Digite o código que mandamos" })).toBeVisible();

  await openAccessLink(page, await capturedLink(email), email, async () => {
    await expect(page.getByText("A página recarregou e a logo não veio junto. Escolha o arquivo de novo.")).toBeVisible();
    await page.locator("#confirm-logo").setInputFiles(logoFile);
  });
  await expect(page).toHaveURL(/\/onboarding\/recebimento$/, { timeout: 20_000 });
  await page.getByRole("link", { name: "Agora não" }).click();
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
  const services = await page.request.get(`/api/public/${slug}/services`);
  expect(services.status()).toBe(200);
  const servicesBody = await services.json() as { logoUrl: string | null };
  expect(servicesBody.logoUrl).toMatch(/^https:\/\/blob\.fake\.local\/logos\//);

  const commit = await page.evaluate(() => {
    const raw = sessionStorage.getItem("agenda_onboarding_commit");
    return raw ? JSON.parse(raw) as { businessId?: string } : null;
  });
  expect(commit?.businessId).toBeTruthy();
  const next = `${slug}-b`;
  const patched = await page.request.patch(`/api/businesses/${commit?.businessId}/profile`, {
    data: { slug: next },
  });
  expect(patched.status()).toBe(200);
  const moved = await page.request.get(`/${slug}?ref=wa`, { maxRedirects: 0 });
  expect(moved.status()).toBe(308);
  const location = moved.headers().location ?? "";
  expect(location).toContain(`/${next}`);
  expect(location).toContain("ref=wa");
});
