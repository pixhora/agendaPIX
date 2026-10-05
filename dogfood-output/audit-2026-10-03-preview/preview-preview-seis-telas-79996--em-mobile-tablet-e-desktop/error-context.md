# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview.spec.ts >> preview: seis telas sem overflow em mobile, tablet e desktop
- Location: tests/qa/preview.spec.ts:3:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3001/preview
Call log:
  - navigating to "http://127.0.0.1:3001/preview", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("preview: seis telas sem overflow em mobile, tablet e desktop", async ({ page, baseURL }) => {
  4  |   const externalRequests: string[] = [];
  5  |   page.on("request", (request) => {
  6  |     const url = new URL(request.url());
  7  |     if (["http:", "https:"].includes(url.protocol) && url.origin !== new URL(baseURL!).origin) externalRequests.push(request.url());
  8  |   });
  9  |   for (const width of [375, 768, 1280]) {
  10 |     await page.setViewportSize({ width, height: 812 });
  11 |     for (const route of ["", "/landing", "/booking", "/dashboard", "/reservas", "/servicos", "/configuracoes"]) {
> 12 |       const response = await page.goto(`/preview${route}`);
     |                                   ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3001/preview
  13 |       expect(response?.status(), `${width}px ${route}`).toBe(200);
  14 |       await expect(page.getByRole("button", { name: /MODO PREVIEW/ })).toBeVisible();
  15 |       expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${route}`).toBe(true);
  16 |     }
  17 |   }
  18 |   expect(externalRequests, "preview não deve carregar recursos HTTP externos").toEqual([]);
  19 | });
  20 | 
  21 | test("preview: booking funciona sem chamadas de backend", async ({ page }) => {
  22 |   const requests: string[] = [];
  23 |   const externalRequests: string[] = [];
  24 |   page.on("request", (request) => {
  25 |     const url = new URL(request.url());
  26 |     if (url.pathname.startsWith("/api/")) requests.push(request.url());
  27 |     if (["http:", "https:"].includes(url.protocol) && url.origin !== new URL(page.url()).origin) externalRequests.push(request.url());
  28 |   });
  29 |   await page.goto("/preview/booking");
  30 |   await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  31 |   const slots = page.getByRole("radiogroup", { name: "Horários disponíveis", exact: true });
  32 |   await expect(slots.getByRole("radio").first()).toBeVisible();
  33 |   expect(requests, "preview não deve consultar banco/API").toEqual([]);
  34 |   await slots.getByRole("radio").first().click();
  35 |   await page.getByRole("button", { name: "Preencher meus dados" }).click();
  36 |   await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  37 |   await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
  38 |   await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  39 |   await expect(page.getByRole("button", { name: "Já fiz o pagamento no banco" })).toBeEnabled();
  40 |   await page.waitForTimeout(4500);
  41 |   expect(requests, "consulta manual e polling devem permanecer locais").toEqual([]);
  42 |   await page.getByRole("button", { name: /Simular Pix Pago/ }).click();
  43 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
  44 |   expect(requests).toEqual([]);
  45 |   expect(externalRequests).toEqual([]);
  46 | });
  47 | 
```