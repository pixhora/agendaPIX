import { expect, test } from "@playwright/test";

test("preview: seis telas sem overflow em mobile, tablet e desktop", async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== new URL(baseURL!).origin) externalRequests.push(request.url());
  });
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    for (const route of ["", "/landing", "/booking", "/dashboard", "/reservas", "/servicos", "/configuracoes"]) {
      const response = await page.goto(`/preview${route}`);
      expect(response?.status(), `${width}px ${route}`).toBe(200);
      await expect(page.getByRole("button", { name: /MODO PREVIEW/ })).toBeVisible();
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${route}`).toBe(true);
    }
  }
  expect(externalRequests, "preview não deve carregar recursos HTTP externos").toEqual([]);
});

test("preview: booking funciona sem chamadas de backend", async ({ page, baseURL }) => {
  const requests: string[] = [];
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) requests.push(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== new URL(baseURL!).origin) externalRequests.push(request.url());
  });
  await page.goto("/preview/booking");
  await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  const slots = page.getByRole("radiogroup", { name: "Horários disponíveis", exact: true });
  await expect(slots.getByRole("radio").first()).toBeVisible();
  expect(requests, "preview não deve consultar banco/API").toEqual([]);
  await slots.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Preencher meus dados" }).click();
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
  await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  await expect(page.getByRole("button", { name: "Já fiz o pagamento no banco" })).toBeEnabled();
  await page.waitForTimeout(4500);
  expect(requests, "consulta manual e polling devem permanecer locais").toEqual([]);
  await page.getByRole("button", { name: /Simular Pix Pago/ }).click();
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
  expect(requests).toEqual([]);
  expect(externalRequests).toEqual([]);
});
