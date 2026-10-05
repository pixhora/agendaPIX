# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview-visual.spec.ts >> preview: valor Pix legível no modo claro
- Location: tests/qa/preview-visual.spec.ts:72:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 3
Received:    1.2647036267654
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - link "← Voltar ao Hub Preview" [ref=e6] [cursor=pointer]:
          - /url: /preview
        - generic [ref=e7]: Studio Bella
      - banner [ref=e8]:
        - heading "Studio Bella" [level=1] [ref=e9]
        - paragraph [ref=e10]: São Paulo, SP · Agendamento online seguro com sinal por Pix
      - navigation "Etapas do agendamento" [ref=e11]:
        - list [ref=e12]:
          - listitem [ref=e13]:
            - generic [ref=e14]: ✓
            - generic [ref=e17]: Serviço
          - listitem [ref=e18]:
            - generic [ref=e19]: ✓
            - generic [ref=e23]: Horário
          - listitem [ref=e24]:
            - generic [ref=e25]: ✓
            - generic [ref=e29]: Dados
          - listitem [ref=e30]:
            - generic [ref=e31]: "4"
            - generic [ref=e34]: Pix
      - generic [ref=e36]:
        - generic [ref=e37]:
          - generic [ref=e38]:
            - heading "Pague o sinal por Pix" [level=2] [ref=e39]
            - paragraph [ref=e40]: Horário pré-reservado. Conclua o Pix para confirmar sua vaga.
          - alert [ref=e41]:
            - paragraph [ref=e42]:
              - generic [ref=e43]: ⚠️
              - text: AMBIENTE DE TESTE / DEMONSTRAÇÃO
            - paragraph [ref=e44]: Este é um Pix simulado para testes. Não envie dinheiro real de sua conta bancária.
          - generic [ref=e45]:
            - generic [ref=e46]:
              - text: Valor do sinal
              - paragraph [ref=e47]: R$ 25,00
              - paragraph [ref=e48]:
                - generic [ref=e49]: "⏳ Expira em:"
                - generic [ref=e50]: 14:59
            - img "QR Code do Pix simulado" [ref=e53]
            - generic [ref=e54]:
              - generic [ref=e55]: "Código Pix Copia e Cola:"
              - generic [ref=e56]:
                - textbox "Código Pix Copia e Cola:" [ref=e57]: 00020126580014br.gov.bcb.pix0136studio-bella-preview-srv-corte-fem52040000530398654025.005802BR5912Studio Bella6009Sao Paulo62070503***6304PREV
                - button "Copiar" [ref=e58] [cursor=pointer]
          - generic [ref=e59]:
            - button "Já fiz o pagamento no banco" [ref=e60] [cursor=pointer]
            - paragraph [ref=e61]: A confirmação é automática em poucos segundos após o pagamento.
        - generic [ref=e62]:
          - paragraph [ref=e63]: Simulador de Pagamento Instantâneo (Preview)
          - button "⚡ Simular Pix Pago no Banco" [ref=e64] [cursor=pointer]
      - contentinfo [ref=e65]: 🔒 Ambiente de Preview determinístico com dados locais.
    - complementary "Controles do Modo Preview" [ref=e66]:
      - button "MODO PREVIEW ▾" [ref=e67]:
        - generic [ref=e69]: MODO PREVIEW
        - generic [ref=e70]: ▾
  - button "Open Next.js Dev Tools" [ref=e76] [cursor=pointer]
  - alert [ref=e80]
```

# Test source

```ts
  1  | import { expect, test, type Locator } from "@playwright/test";
  2  | 
  3  | async function contrast(locator: Locator) {
  4  |   return locator.evaluate((element) => {
  5  |     const canvas = document.createElement("canvas");
  6  |     canvas.width = canvas.height = 1;
  7  |     const context = canvas.getContext("2d")!;
  8  |     const rgba = (color: string) => {
  9  |       context.clearRect(0, 0, 1, 1);
  10 |       context.fillStyle = color;
  11 |       context.fillRect(0, 0, 1, 1);
  12 |       return Array.from(context.getImageData(0, 0, 1, 1).data);
  13 |     };
  14 |     const layers: number[][] = [];
  15 |     for (let node: Element | null = element; node; node = node.parentElement) {
  16 |       layers.push(rgba(getComputedStyle(node).backgroundColor));
  17 |     }
  18 |     const blend = (base: number[], layer: number[]) => base.map((channel, index) => channel * (1 - layer[3] / 255) + layer[index] * layer[3] / 255);
  19 |     const background = layers.reverse().reduce(blend, [255, 255, 255]);
  20 |     const foreground = blend(background, rgba(getComputedStyle(element).color));
  21 |     const luminance = (channels: number[]) => channels.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  22 |     const a = luminance(foreground), b = luminance(background);
  23 |     return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  24 |   });
  25 | }
  26 | 
  27 | test("nova direção: contraste do sinal no booking claro", async ({ page }, info) => {
  28 |   await page.emulateMedia({ colorScheme: "light" });
  29 |   await page.goto("/preview/booking");
  30 |   const deposit = page.getByText("Sinal: R$ 25,00", { exact: true });
  31 |   await expect(deposit).toBeVisible();
  32 |   await page.screenshot({ path: info.outputPath("booking-light-375.png"), fullPage: true });
  33 |   expect(await contrast(deposit)).toBeGreaterThanOrEqual(4.5);
  34 | });
  35 | 
  36 | test("nova direção: contraste do hero escuro e CTA mobile", async ({ page }, info) => {
  37 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  38 |   await page.goto("/preview/landing");
  39 |   const heading = page.getByRole("heading", { level: 1 });
  40 |   await expect(heading).toBeVisible();
  41 |   await page.screenshot({ path: info.outputPath("landing-dark-375.png"), fullPage: true });
  42 |   expect.soft(await contrast(heading)).toBeGreaterThanOrEqual(3);
  43 |   const cta = page.getByRole("link", { name: "Testar Booking", exact: true });
  44 |   expect.soft((await cta.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  45 |   await cta.focus();
  46 |   const focus = await cta.evaluate((element) => {
  47 |     const style = getComputedStyle(element);
  48 |     return (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
  49 |   });
  50 |   expect.soft(focus).toBe(true);
  51 | });
  52 | 
  53 | test("preview: teclado e reduced-motion no booking", async ({ page }) => {
  54 |   await page.emulateMedia({ reducedMotion: "reduce" });
  55 |   await page.goto("/preview/booking");
  56 |   const service = page.getByRole("radio", { name: /Corte feminino/ });
  57 |   await service.focus();
  58 |   await service.press("ArrowRight");
  59 |   await expect.soft(page.getByRole("radio", { name: /Corte \+ escova/ })).toHaveAttribute("aria-checked", "true");
  60 |   const next = page.getByRole("button", { name: "Continuar para escolher horário" });
  61 |   await next.focus();
  62 |   const timing = await next.evaluate((element) => {
  63 |     const style = getComputedStyle(element);
  64 |     return { transition: parseFloat(style.transitionDuration), animation: parseFloat(style.animationDuration) };
  65 |   });
  66 |   expect(timing.transition).toBeLessThanOrEqual(0.001);
  67 |   expect(timing.animation).toBeLessThanOrEqual(0.001);
  68 |   await next.press("Enter");
  69 |   await expect(page.getByRole("heading", { name: "Escolha o horário" })).toBeVisible();
  70 | });
  71 | 
  72 | test("preview: valor Pix legível no modo claro", async ({ page }) => {
  73 |   await page.emulateMedia({ colorScheme: "light" });
  74 |   await page.goto("/preview/booking");
  75 |   await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  76 |   await page.getByRole("radiogroup", { name: "Horários disponíveis", exact: true }).getByRole("radio").first().click();
  77 |   await page.getByRole("button", { name: "Preencher meus dados" }).click();
  78 |   await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  79 |   await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
  80 |   const amount = page.getByText("R$ 25,00", { exact: true });
  81 |   await expect(amount).toBeVisible();
> 82 |   expect(await contrast(amount)).toBeGreaterThanOrEqual(3);
     |                                  ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  83 | });
  84 | 
```