import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`login do painel: 375px ${colorScheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/dashboard/login");
    await expect(page.getByRole("heading", { name: "Entre no seu painel" })).toBeVisible();
    await expect(page.getByLabel("Seu email")).toBeVisible();
    const button = page.getByRole("button", { name: "Receber link de acesso" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
