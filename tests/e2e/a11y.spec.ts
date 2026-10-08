import { expect } from "@playwright/test";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow, ownerStorageState, readMeta } from "./helpers";

const meta = readMeta();

test.describe("acessibilidade (axe) e reflow — páginas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const [path, heading] of [
    ["/", /Seu cliente agenda sozinho/],
    ["/login", /Entrar na sua conta/],
    ["/login?error=link", /Entrar na sua conta/],
    ["/onboarding", /Nome e link da sua página/],
  ] as const) {
    test(`${path} sem violações`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page, path);
    });
  }

  test("tema escuro (landing e página pública) sem violações de contraste", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoAxeViolations(page, "landing escura");
    await page.goto(`/${meta.businessASlug}`);
    await expect(page.getByRole("radiogroup", { name: /Serviços/ })).toBeVisible();
    await expectNoAxeViolations(page, "página pública escura");
  });

  test("login com e-mail inválido mostra erro no campo, sem botão desabilitado", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel("E-mail profissional");
    await email.fill("maria@");
    await page.getByRole("button", { name: "Receber link de acesso" }).click();
    await expect(page.getByText("Digite um e-mail válido")).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toBeFocused();
    await expectNoAxeViolations(page, "login com erro");
  });

  test("alternador de tema persiste sem flash ao recarregar", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("radio", { name: "Tema escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    // O script inline aplica a classe antes da hidratação.
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("radio", { name: "Tema escuro" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Tema claro" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
  });
});

test.describe("acessibilidade (axe) e reflow — painel", () => {
  test.use({ storageState: ownerStorageState });

  for (const path of ["/dashboard", "/dashboard?view=week", "/dashboard/services", "/dashboard/customers", "/dashboard/settings"]) {
    test(`${path} sem violações`, async ({ page }) => {
      await page.goto(`${path}${path.includes("?") ? "&" : "?"}businessId=${meta.businessAId}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page, path);
    });
  }

  test("painel escuro sem violações", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/dashboard?businessId=${meta.businessAId}`);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoAxeViolations(page, "painel escuro");
  });
});
