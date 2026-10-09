import { expect, test } from "@playwright/test";

test("termos e privacidade publicados mostram as âncoras", async ({ page }) => {
  for (const path of ["/termos", "/privacidade"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("[id='5']")).toBeVisible();
    await expect(page.locator("[id='5-a']")).toBeVisible();
    await expect(page.locator("[id='4-1']")).toBeVisible();
    await expect(page.getByRole("link", { name: "Link da seção 5-a" })).toHaveCount(1);
    await expect(page.getByText("Rascunho para revisão")).toHaveCount(0);
  }
});
