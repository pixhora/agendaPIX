import { expect, test } from "@playwright/test";

// Decisão comercial: agenda-backend/docs/PRECOS.md, 03/10/2026.
// Não valida nem altera valores de serviços, demonstrações ou sinais Pix.
for (const route of ["/", "/preview/landing"]) {
  test(`assinatura aprovada e trial preservado: ${route}`, async ({ page }) => {
    await page.goto(route);
    const pricing = page.locator("#precos");
    for (const [name, amount] of [["Plano Base", 49], ["Plano Completo", 79]] as const) {
      const card = pricing.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::div[.//h3 and .//a][1]");
      await expect(card.getByText(new RegExp(`^R\\$\\s*${amount}(?:[,.]00)?$`))).toBeVisible();
      await expect(card.getByText(/\/\s*mês/)).toBeVisible();
    }
    await expect(pricing).toContainText(/7 dias/);
    // Restrito à seção da assinatura: coincidências em serviços/demo são válidas.
    await expect(pricing).not.toContainText(/R\$\s*(?:29|59)(?:[,.]00)?\b/);
  });
}

for (const plan of ["base", "completo"]) {
  test(`onboarding preserva plano ${plan} e trial de 7 dias`, async ({ page }) => {
    await page.goto(`/onboarding?plano=${plan}`);
    await expect(page.locator("header")).toContainText(/7 dias grátis/);
    await expect(page.locator("header")).toContainText(plan === "base" ? "Plano Base" : "Plano Completo");
  });
}
