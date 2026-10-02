import { expect, test } from "@playwright/test";

test("esqueleto abre no celular e responde à verificação de saúde", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});
