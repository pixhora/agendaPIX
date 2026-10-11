import { expect } from "@playwright/test";
import { test } from "./helpers";

const COMMIT = JSON.stringify({
  slug: "studio-ana",
  publicPath: "/studio-ana",
  businessId: "00000000-0000-4000-8000-0000000000a1",
});

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((commit) => {
    sessionStorage.setItem("agenda_onboarding_commit", commit);
  }, COMMIT);
});

test("marcar a autorização do Mercado Pago não deixa a tela em branco", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/onboarding/recebimento");
  await expect(page.getByRole("heading", { name: /Conecte sua conta Mercado Pago/ })).toBeVisible();
  await page.locator("label").filter({ hasText: "Entendi e autorizo" }).click();
  await expect(page.getByRole("checkbox", { name: /Entendi e autorizo/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Continuar para o Mercado Pago" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: /Conecte sua conta Mercado Pago/ })).toBeAttached();
  const shellScroll = await page.locator("[data-mp-shell]").evaluate((node) => node.scrollTop);
  expect(shellScroll).toBe(0);
  expect(pageErrors).toEqual([]);
});

test("o error boundary do retorno do Mercado Pago oferece tentar de novo", async ({ page }) => {
  const logged: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") logged.push(message.text());
  });
  await page.goto("/onboarding/recebimento?erro=retorno");
  await expect(page.getByRole("heading", { name: "Não conseguimos voltar do Mercado Pago" })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("agenda_onboarding_draft", JSON.stringify({ businessName: "Rascunho antigo" }));
    localStorage.setItem("agenda_onboarding_step", "email");
    localStorage.setItem("agenda_onboarding_draft_id", "draft-antigo");
    sessionStorage.setItem("agendapix.mp.callback", JSON.stringify({ mp: "error", reason: "exchange_failed" }));
  });
  await expect(page.getByText("Sua conta não foi alterada. Toque em \"Tentar de novo\" pra reconectar.")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("onboarding_mp_return_probe");
  await expect(page.getByRole("link", { name: "Falar com o suporte" })).toHaveAttribute("href", "https://wa.me/5514997504655");
  expect(logged.some((line) => line.includes("onboarding_mp_return") && line.includes("onboarding_mp_return_probe"))).toBe(true);
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page).toHaveURL(/\/onboarding\/recebimento$/);
  await expect(page.getByRole("heading", { name: /Conecte sua conta Mercado Pago/ })).toBeVisible();
  const draft = await page.evaluate(() => ({
    draft: localStorage.getItem("agenda_onboarding_draft"),
    step: localStorage.getItem("agenda_onboarding_step"),
    id: localStorage.getItem("agenda_onboarding_draft_id"),
    callback: sessionStorage.getItem("agendapix.mp.callback"),
  }));
  expect(draft).toEqual({ draft: null, step: null, id: null, callback: null });
});
