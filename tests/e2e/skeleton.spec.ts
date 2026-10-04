import { expect, test } from "@playwright/test";

test("esqueleto abre no celular e responde à verificação de saúde", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});


test("dashboard não publica cópias locais das APIs da autoridade", async ({ request }) => {
  const session = await request.get("/api/auth/get-session");
  expect(session.status()).toBe(404);

  const services = await request.get("/api/public/barbearia-demo/services");
  expect(services.status()).toBe(404);

  const webhook = await request.post("/api/webhooks/payments/fake", { data: {} });
  expect(webhook.status()).toBe(404);
});
