import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 390, 1280]) {
    test(`login real: ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/dashboard/login");
      await expect(page.getByRole("link", { name: "Agenda, início" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Entre no seu painel" })).toBeVisible();
      const input = page.getByLabel("Seu email");
      const button = page.getByRole("button", { name: "Receber link de acesso" });
      for (const control of [input, button, page.getByRole("link", { name: "Agenda, início" })]) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await button.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(192, 247, 57)");
      await page.screenshot({ path: testInfo.outputPath(`login-${width}-${colorScheme}.png`), fullPage: true });
      await page.getByRole("link", { name: "Agenda, início" }).focus();
      await page.keyboard.press("Tab");
      await expect(input).toBeFocused();
    });
  }
}

test("estados do login: espera HTTP, mantém callbacks e trata sucesso/falha", async ({ page }) => {
  // Respostas controladas provam somente estados da UI. Não simulam envio no produto.
  let release!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { release = resolve; });
  let observedBody: unknown;
  await page.route("**/api/auth/sign-in/magic-link", async (route) => {
    observedBody = route.request().postDataJSON();
    await pendingResponse;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: true }) });
  });
  await page.goto("/dashboard/login");
  await page.getByLabel("Seu email").fill("qa-login@example.com");
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  try {
    await expect(page.getByRole("button", { name: "Enviando link…" })).toBeDisabled();
    await expect(page.getByLabel("Seu email")).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator('form [role="status"]')).toHaveText("Enviando link de acesso…");
  } finally { release(); }
  await expect(page.locator('form [role="status"]')).toContainText("Confira sua caixa de entrada");
  expect(observedBody).toEqual({ email: "qa-login@example.com", callbackURL: "/dashboard", errorCallbackURL: "/dashboard/login?error=link" });
  await page.unroute("**/api/auth/sign-in/magic-link");
  await page.route("**/api/auth/sign-in/magic-link", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "EMAIL_UNAVAILABLE", message: "Envio indisponível" }) }));
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  const alert = page.locator('form [role="alert"]');
  await expect(alert).toContainText("Não foi possível enviar o link");
  await expect(alert).toBeFocused();
  await expect(page.locator('form [role="status"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Receber link de acesso" })).toBeEnabled();
});

test("link indisponível oferece novo envio acessível", async ({ page }) => {
  await page.goto("/dashboard/login?error=link");
  const alert = page.locator('form [role="alert"]');
  await expect(alert).toContainText("Solicite um novo link de acesso");
  await expect(alert).toBeFocused();
  await expect(page.getByLabel("Seu email")).toHaveAttribute("aria-describedby", "email-hint login-error");
});
