# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview.spec.ts >> preview: booking funciona sem chamadas de backend
- Location: tests/qa/preview.spec.ts:15:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('radiogroup', { name: 'Horários disponíveis', exact: true }).getByRole('radio').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('radiogroup', { name: 'Horários disponíveis', exact: true }).getByRole('radio').first() with timeout 10000ms
  - waiting for getByRole('radiogroup', { name: 'Horários disponíveis', exact: true }).getByRole('radio').first()

```

```yaml
- link "← Voltar ao Hub Preview":
  - /url: /preview
- text: Studio Bella
- banner:
  - heading "Studio Bella" [level=1]
  - paragraph: São Paulo, SP · Agendamento online seguro com sinal por Pix
- navigation "Etapas do agendamento":
  - list:
    - listitem: 1 Serviço
    - listitem: 2 Horário
    - listitem: 3 Dados
    - listitem: 4 Pix
- heading "Escolha o serviço" [level=2]
- paragraph: Selecione o procedimento que você deseja agendar.
- radiogroup "Serviços disponíveis":
  - 'radio "Corte feminino ⏱ 1h • Total: R$ 80,00 Sinal: R$ 25,00" [checked]':
    - heading "Corte feminino" [level=3]
    - text: "⏱ 1h • Total: R$ 80,00 Sinal: R$ 25,00"
  - 'radio "Corte + escova ⏱ 1h 30min • Total: R$ 120,00 Sinal: R$ 40,00"':
    - heading "Corte + escova" [level=3]
    - text: "⏱ 1h 30min • Total: R$ 120,00 Sinal: R$ 40,00"
  - 'radio "Manicure ⏱ 45 min • Total: R$ 45,00 Sinal: R$ 15,00"':
    - heading "Manicure" [level=3]
    - text: "⏱ 45 min • Total: R$ 45,00 Sinal: R$ 15,00"
- button "Continuar para escolher horário"
- contentinfo: 🔒 Ambiente de Preview determinístico com dados locais.
- complementary "Controles do Modo Preview":
  - button "MODO PREVIEW ▾"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("preview: seis telas sem overflow em mobile, tablet e desktop", async ({ page }) => {
  4  |   for (const width of [375, 768, 1280]) {
  5  |     await page.setViewportSize({ width, height: 812 });
  6  |     for (const route of ["", "/landing", "/booking", "/dashboard", "/reservas", "/servicos", "/configuracoes"]) {
  7  |       const response = await page.goto(`/preview${route}`);
  8  |       expect(response?.status(), `${width}px ${route}`).toBe(200);
  9  |       await expect(page.getByRole("button", { name: /MODO PREVIEW/ })).toBeVisible();
  10 |       expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${route}`).toBe(true);
  11 |     }
  12 |   }
  13 | });
  14 | 
  15 | test("preview: booking funciona sem chamadas de backend", async ({ page }) => {
  16 |   const requests: string[] = [];
  17 |   page.on("request", (request) => {
  18 |     if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
  19 |   });
  20 |   await page.goto("/preview/booking");
  21 |   await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  22 |   const slots = page.getByRole("radiogroup", { name: "Horários disponíveis", exact: true });
> 23 |   await expect(slots.getByRole("radio").first()).toBeVisible();
     |                                                  ^ Error: expect(locator).toBeVisible() failed
  24 |   expect(requests, "preview não deve consultar banco/API").toEqual([]);
  25 |   await slots.getByRole("radio").first().click();
  26 |   await page.getByRole("button", { name: "Preencher meus dados" }).click();
  27 |   await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  28 |   await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
  29 |   await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  30 |   await expect(page.getByRole("button", { name: "Já fiz o pagamento no banco" })).toBeEnabled();
  31 |   await page.waitForTimeout(4500);
  32 |   expect(requests, "consulta manual e polling devem permanecer locais").toEqual([]);
  33 |   await page.getByRole("button", { name: /Simular Pix Pago/ }).click();
  34 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
  35 |   expect(requests).toEqual([]);
  36 | });
  37 | 
```