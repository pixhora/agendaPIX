# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview-visual.spec.ts >> nova direção: contraste do sinal no booking claro
- Location: tests/qa/preview-visual.spec.ts:27:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 4.5
Received:    1.2166275847379875
```

# Page snapshot

```yaml
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
          - generic [ref=e14]: "1"
          - generic [ref=e17]: Serviço
        - listitem [ref=e18]:
          - generic [ref=e19]: "2"
          - generic [ref=e23]: Horário
        - listitem [ref=e24]:
          - generic [ref=e25]: "3"
          - generic [ref=e29]: Dados
        - listitem [ref=e30]:
          - generic [ref=e31]: "4"
          - generic [ref=e34]: Pix
    - generic [ref=e36]:
      - generic [ref=e37]:
        - heading "Escolha o serviço" [level=2] [ref=e38]
        - paragraph [ref=e39]: Selecione o procedimento que você deseja agendar.
      - radiogroup "Serviços disponíveis" [ref=e40]:
        - 'radio "Corte feminino ⏱ 1h • Total: R$ 80,00 Sinal: R$ 25,00" [checked] [ref=e41]':
          - generic [ref=e42]:
            - generic [ref=e43]:
              - heading "Corte feminino" [level=3] [ref=e44]
              - generic [ref=e45]:
                - generic [ref=e46]: ⏱ 1h
                - generic [ref=e47]: •
                - generic [ref=e48]: "Total: R$ 80,00"
            - generic [ref=e49]: "Sinal: R$ 25,00"
        - 'radio "Corte + escova ⏱ 1h 30min • Total: R$ 120,00 Sinal: R$ 40,00" [ref=e51]':
          - generic [ref=e52]:
            - generic [ref=e53]:
              - heading "Corte + escova" [level=3] [ref=e54]
              - generic [ref=e55]:
                - generic [ref=e56]: ⏱ 1h 30min
                - generic [ref=e57]: •
                - generic [ref=e58]: "Total: R$ 120,00"
            - generic [ref=e59]: "Sinal: R$ 40,00"
        - 'radio "Manicure ⏱ 45 min • Total: R$ 45,00 Sinal: R$ 15,00" [ref=e61]':
          - generic [ref=e62]:
            - generic [ref=e63]:
              - heading "Manicure" [level=3] [ref=e64]
              - generic [ref=e65]:
                - generic [ref=e66]: ⏱ 45 min
                - generic [ref=e67]: •
                - generic [ref=e68]: "Total: R$ 45,00"
            - generic [ref=e69]: "Sinal: R$ 15,00"
      - button "Continuar para escolher horário" [ref=e72] [cursor=pointer]
    - contentinfo [ref=e73]: 🔒 Ambiente de Preview determinístico com dados locais.
  - complementary "Controles do Modo Preview" [ref=e74]:
    - button "MODO PREVIEW ▾" [ref=e75]:
      - generic [ref=e77]: MODO PREVIEW
      - generic [ref=e78]: ▾
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
> 33 |   expect(await contrast(deposit)).toBeGreaterThanOrEqual(4.5);
     |                                   ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
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
```