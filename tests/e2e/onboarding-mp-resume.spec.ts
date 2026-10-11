import { expect } from "@playwright/test";
import { ownerStorageState, readMeta, test } from "./helpers";

const meta = readMeta();

test.describe("retorno do Mercado Pago sem a aba do cadastro", () => {
  test.use({ storageState: ownerStorageState });

  test("uma aba nova recupera o cadastro pela sessão, sem id na URL", async ({ page, context }) => {
    await page.goto("/onboarding/recebimento");
    const tab = await context.newPage();
    const resumes: string[] = [];
    tab.on("request", (request) => {
      if (request.method() === "GET" && request.url().includes("/api/onboarding/resume")) resumes.push(request.url());
    });
    await tab.goto(`/onboarding/recebimento?businessId=${meta.businessBId}&slug=${meta.businessBSlug}&mp=connected`);
    await expect(tab.getByRole("heading", { name: "Mercado Pago" })).toBeVisible();
    await expect(tab.getByText("Conectado", { exact: true })).toBeVisible();
    await expect(tab.getByRole("heading", { name: "Não encontramos este cadastro" })).toHaveCount(0);
    await expect(tab.getByRole("heading", { name: /Seu cadastro está salvo/ })).toHaveCount(0);
    expect(resumes.length).toBeGreaterThan(0);
    for (const resume of resumes) {
      const resumeUrl = new URL(resume);
      expect(resumeUrl.pathname).toBe("/api/onboarding/resume");
      expect(resumeUrl.search).toBe("");
    }
    await expect(tab.locator("form").filter({ has: tab.getByRole("button", { name: "Reconectar" }) })).toHaveAttribute("action", `/api/businesses/${meta.businessAId}/mercadopago/connect`);
    expect(tab.url()).not.toContain(meta.businessBId);
    expect(tab.url()).not.toContain("slug=");
    expect(tab.url()).toContain("mp=connected");
  });
});

test.describe("retorno do Mercado Pago sem sessão", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pede o e-mail para continuar, mesmo com id na URL", async ({ page }) => {
    await page.goto(`/onboarding/recebimento?businessId=${meta.businessAId}&slug=${meta.businessASlug}`);
    await expect(page.getByRole("heading", { name: "Seu cadastro está salvo." })).toBeVisible();
    await expect(page.getByText("Entre com seu e-mail para continuar de onde parou.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login?next=%2Fonboarding%2Frecebimento");
    await expect(page.getByRole("heading", { name: /Conecte sua conta Mercado Pago/ })).toHaveCount(0);
    expect(page.url()).not.toContain(meta.businessAId);
  });
});
