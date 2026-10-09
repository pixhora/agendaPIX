import { expect } from "@playwright/test";
import { test } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test("a demonstração pública simula o pagamento sem Pix real", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
  });

  const response = await page.goto("/exemplo");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Demonstração · AgendaPix");
  await expect(page.getByRole("note")).toHaveText("Demonstração com dados fictícios. Nenhum Pix real é gerado.");
  await expect(page.getByRole("link", { name: /preview/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Escolher horário" }).click();
  await page.getByRole("radio", { name: /^\d{2}:\d{2}$/ }).first().click();
  await page.getByRole("button", { name: /Continuar com/ }).click();
  await page.getByRole("button", { name: /Gerar Pix de/ }).click();
  await page.getByRole("button", { name: "Simular pagamento (demonstração)" }).click();
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();

  expect(requests.some((url) => /mercadopago|\/api\/public\//.test(url))).toBe(false);
});
