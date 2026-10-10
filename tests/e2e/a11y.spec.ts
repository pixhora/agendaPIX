import { expect, type Page } from "@playwright/test";
import { test, collectCspViolations, expectNoAxeViolations, expectNoHorizontalOverflow, expectThemeScriptNonce, installCspProbe, ownerStorageState, readMeta } from "./helpers";

async function submitForm(page: Page, action: string) {
  await page.evaluate((target) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = target;
    document.body.append(form);
    form.submit();
  }, action).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!/context was destroyed|navigation/i.test(message)) throw error;
  });
}

const meta = readMeta();

test.describe("acessibilidade (axe) e reflow — páginas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const [path, heading] of [
    ["/", /Seu cliente agenda sozinho/],
    ["/login", /Entrar na sua conta/],
    ["/login?error=link", /Entrar na sua conta/],
    ["/onboarding", /Sua loja/],
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
    const violations = collectCspViolations(page);
    await installCspProbe(page);
    const first = await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expectThemeScriptNonce(first);
    await page.getByRole("radio", { name: "Tema escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const reloaded = await page.reload({ waitUntil: "domcontentloaded" });
    await expectThemeScriptNonce(reloaded);
    // O script inline aplica a classe antes da hidratação.
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("radio", { name: "Tema escuro" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Tema claro" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    expect(violations, "violação de CSP no login").toEqual([]);
  });

  test("POST com 303 para wa.me não gera violação de CSP", async ({ page }) => {
    const violations = collectCspViolations(page);
    await installCspProbe(page);
    // wa.me responde 302 para api.whatsapp.com; os dois precisam passar no form-action.
    await page.route(/https:\/\/wa\.me\//, (route) => route.fulfill({
      status: 302,
      headers: { location: "https://api.whatsapp.com/send/?phone=5511900000000" },
      body: "",
    }));
    await page.route(/https:\/\/api\.whatsapp\.com\//, (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>whatsapp</title>",
    }));
    await page.goto("/login");
    await submitForm(page, "/api/dev/form-redirect?to=wa");
    await page.waitForURL(/https:\/\/api\.whatsapp\.com\//, { waitUntil: "commit" });
    expect(violations, "violação de CSP no redirect do formulário").toEqual([]);
  });

  test("POST com 303 para host fora da lista gera violação de CSP", async ({ page }) => {
    const violations = collectCspViolations(page);
    await installCspProbe(page);
    await page.route(/https:\/\/example\.com\//, (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>blocked</title>",
    }));
    await page.goto("/login");
    const posted = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/api/dev/form-redirect?to=blocked"));
    const reported = page.waitForEvent("console", { predicate: (message) => /form-action/i.test(message.text()), timeout: 5_000 });
    await submitForm(page, "/api/dev/form-redirect?to=blocked");
    await posted;
    await reported;
    expect(page.url()).toContain("/login");
    expect(violations.some((entry) => /form-action/i.test(entry))).toBe(true);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`CSP e tema ${theme} na landing, login e página pública`, async ({ page }) => {
      const violations = collectCspViolations(page);
      await installCspProbe(page);
      await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
      for (const path of ["/", "/login", `/${meta.businessASlug}`] as const) {
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        await expectThemeScriptNonce(response);
        expect(await page.evaluate(() => document.documentElement.className)).toContain(theme);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(violations, `violação de CSP em ${path} (${theme})`).toEqual([]);
      }
    });
  }
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

  for (const theme of ["light", "dark"] as const) {
    test(`CSP e tema ${theme} no painel`, async ({ page }) => {
      const violations = collectCspViolations(page);
      await installCspProbe(page);
      await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
      const response = await page.goto(`/dashboard?businessId=${meta.businessAId}`, { waitUntil: "domcontentloaded" });
      await expectThemeScriptNonce(response);
      expect(await page.evaluate(() => document.documentElement.className)).toContain(theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(violations, `violação de CSP no painel (${theme})`).toEqual([]);
    });
  }
});
