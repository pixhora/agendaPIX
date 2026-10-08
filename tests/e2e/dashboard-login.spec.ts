import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`login único: 375px ${colorScheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
    await expect(page.getByLabel("E-mail profissional")).toBeVisible();
    const button = page.getByRole("button", { name: "Receber link de acesso" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("/dashboard/login legado redireciona para /login preservando o erro", async ({ page }) => {
  await page.goto("/dashboard/login?error=link");
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.locator("#login-error")).toContainText("expirou ou já foi usado");
});
