import { expect, test } from "@playwright/test";
import { readMeta } from "./helpers";

const meta = readMeta();

test("slug que não existe responde 404 e a loja semeada continua 200", async ({ page }) => {
  const missing = await page.goto("/nao-existe-xyz");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Não encontramos essa página." })).toBeVisible();

  const known = await page.goto(`/${meta.businessASlug}`);
  expect(known?.status()).toBe(200);
});
