import { expect, test } from "@playwright/test";

test("termos e privacidade respondem 404 com a publicação desligada", async ({ page }) => {
  for (const path of ["/termos", "/privacidade"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});
