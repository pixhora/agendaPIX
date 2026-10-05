# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview-visual.spec.ts >> preview: teclado e reduced-motion no booking
- Location: tests/qa/preview-visual.spec.ts:53:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('radio', { name: /Corte \+ escova/ })
Expected: "true"
Received: "false"
Timeout:  10000ms

Call log:
  - Expect "soft toHaveAttribute" getByRole('radio', { name: /Corte \+ escova/ }) with timeout 10000ms
  - waiting for getByRole('radio', { name: /Corte \+ escova/ })
    24 × locator resolved to <button role="radio" type="button" aria-checked="false" class="w-full text-left p-4 rounded-xl border transition-all min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary border-border bg-surface hover:border-muted-foreground/40 hover:bg-muted/50">…</button>
       - unexpected value "false"

```

```yaml
- 'radio "Corte + escova ⏱ 1h 30min • Total: R$ 120,00 Sinal: R$ 40,00"':
  - heading "Corte + escova" [level=3]
  - text: "⏱ 1h 30min • Total: R$ 120,00 Sinal: R$ 40,00"
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
> 59 |   await expect.soft(page.getByRole("radio", { name: /Corte \+ escova/ })).toHaveAttribute("aria-checked", "true");
     |                                                                           ^ Error: expect(locator).toHaveAttribute(expected) failed
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
  82 |   expect(await contrast(amount)).toBeGreaterThanOrEqual(3);
  83 | });
  84 | 
```