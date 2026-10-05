# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: slot-ruler.spec.ts >> régua Corte + escova: 375px light
- Location: tests/qa/slot-ruler.spec.ts:5:5

# Error details

```
Error: scrollbar deve respeitar no-scrollbar

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

```
Error: badge ativo 5 vagas exige contraste AA 4.5:1

expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 4.5
Received:    2.009566449424849
```

```
Error: dia 3 alcançável por Tab

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

```
Error: dia 6 alcançável por Tab

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

```
Error: foco não deve ser recortado pela régua

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   0,
+   3,
+   6,
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
          - heading "Escolha o horário" [level=2] [ref=e38]
          - paragraph [ref=e39]: "Corte + escova • Sinal: R$ 40,00"
        - region "Régua de datas disponíveis" [ref=e40]:
          - generic [ref=e41]:
            - button "Hoje 03/10 5 vagas" [pressed] [ref=e42]:
              - generic [ref=e43]: Hoje
              - generic [ref=e44]: 03/10
              - generic [ref=e45]: 5 vagas
            - button "Amanhã 04/10 5 vagas" [ref=e46]:
              - generic [ref=e47]: Amanhã
              - generic [ref=e48]: 04/10
              - generic [ref=e49]: 5 vagas
            - button "SEG 05/10 5 vagas" [ref=e50]:
              - generic [ref=e51]: SEG
              - generic [ref=e52]: 05/10
              - generic [ref=e53]: 5 vagas
            - button "TER 06/10 5 vagas" [ref=e54]:
              - generic [ref=e55]: TER
              - generic [ref=e56]: 06/10
              - generic [ref=e57]: 5 vagas
            - button "QUA 07/10 5 vagas" [ref=e58]:
              - generic [ref=e59]: QUA
              - generic [ref=e60]: 07/10
              - generic [ref=e61]: 5 vagas
            - button "QUI 08/10 5 vagas" [ref=e62]:
              - generic [ref=e63]: QUI
              - generic [ref=e64]: 08/10
              - generic [ref=e65]: 5 vagas
            - button "SEX 09/10 5 vagas" [active] [ref=e66]:
              - generic [ref=e67]: SEX
              - generic [ref=e68]: 09/10
              - generic [ref=e69]: 5 vagas
        - region "Horários disponíveis no dia" [ref=e70]:
          - radiogroup "Horários disponíveis" [ref=e71]:
            - radio "11:30" [checked] [ref=e72]
            - radio "13:30" [ref=e73]
            - radio "15:30" [ref=e74]
            - radio "16:30" [ref=e75]
            - radio "17:30" [ref=e76]
        - generic [ref=e77]:
          - button "Voltar" [ref=e78] [cursor=pointer]
          - button "Preencher meus dados" [ref=e79] [cursor=pointer]
      - contentinfo [ref=e80]: 🔒 Ambiente de Preview determinístico com dados locais.
    - complementary "Controles do Modo Preview" [ref=e81]:
      - button "MODO PREVIEW ▾" [ref=e82]:
        - generic [ref=e84]: MODO PREVIEW
        - generic [ref=e85]: ▾
  - button "Open Next.js Dev Tools" [ref=e91] [cursor=pointer]
  - alert [ref=e95]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | for (const colorScheme of ["light", "dark"] as const) {
  4  |   for (const width of [375, 1280]) {
  5  |     test(`régua Corte + escova: ${width}px ${colorScheme}`, async ({ browser, baseURL }, testInfo) => {
  6  |       const context = await browser.newContext({ baseURL, viewport: { width, height: 812 }, colorScheme, hasTouch: true, reducedMotion: "reduce" });
  7  |       const page = await context.newPage();
  8  |       await page.goto("/preview/booking");
  9  |       await page.getByRole("radio", { name: /Corte \+ escova/ }).click();
  10 |       await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  11 |       const ruler = page.getByRole("region", { name: "Régua de datas disponíveis" }).locator("div").first();
  12 |       const days = ruler.getByRole("button");
  13 |       await expect(days.first().locator("span").last()).toHaveText("5 vagas");
  14 |       await page.screenshot({ path: testInfo.outputPath("initial.png"), fullPage: false });
  15 |       const initial = await ruler.evaluate((element) => {
  16 |         const style = getComputedStyle(element);
  17 |         return { scrollbarWidth: style.scrollbarWidth, webkitDisplay: getComputedStyle(element, "::-webkit-scrollbar").display, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
  18 |       });
  19 |       expect.soft(initial.scrollbarWidth === "none" || initial.webkitDisplay === "none", "scrollbar deve respeitar no-scrollbar").toBe(true);
  20 |       const ratio = await days.first().locator("span").last().evaluate((element) => {
  21 |         const rgba = (value: string) => value.match(/[\d.]+/g)!.map(Number);
  22 |         const composite = (top: number[], bottom: number[]) => top.slice(0, 3).map((value, i) => value * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1)));
  23 |         let background = [255, 255, 255];
  24 |         const ancestors: Element[] = [];
  25 |         for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
  26 |         for (const ancestor of ancestors) background = composite(rgba(getComputedStyle(ancestor).backgroundColor), background);
  27 |         const foreground = composite(rgba(getComputedStyle(element).color), background);
  28 |         const luminance = (rgb: number[]) => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  29 |         const a = luminance(foreground), b = luminance(background);
  30 |         return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  31 |       });
  32 |       expect.soft(ratio, "badge ativo 5 vagas exige contraste AA 4.5:1").toBeGreaterThanOrEqual(4.5);
  33 |       await days.first().focus();
  34 |       const focusClips: number[] = [];
  35 |       for (let i = 0; i < await days.count(); i++) {
  36 |         await expect(days.nth(i)).toBeFocused();
  37 |         const geometry = await days.nth(i).evaluate((element) => {
  38 |           const box = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect(), style = getComputedStyle(element);
  39 |           const outline = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
  40 |           return { visible: box.left >= parent.left - 1 && box.right <= parent.right + 1, clipped: box.left - outline < parent.left - 1 || box.right + outline > parent.right + 1 || box.top - outline < parent.top - 1 || box.bottom + outline > parent.bottom + 1 };
  41 |         });
  42 |         expect.soft(geometry.visible, `dia ${i} alcançável por Tab`).toBe(true);
  43 |         if (geometry.clipped) focusClips.push(i);
  44 |         if (i < await days.count() - 1) await page.keyboard.press("Tab");
  45 |       }
  46 |       await page.screenshot({ path: testInfo.outputPath("last-day-focus.png") });
> 47 |       expect.soft(focusClips, "foco não deve ser recortado pela régua").toEqual([]);
     |                                                                         ^ Error: foco não deve ser recortado pela régua
  48 |       await ruler.evaluate(element => { element.scrollLeft = 0; });
  49 |       const box = (await ruler.boundingBox())!;
  50 |       const cdp = await context.newCDPSession(page);
  51 |       const start = box.x + box.width - 15, end = box.x + 15, y = box.y + box.height / 2;
  52 |       for (let swipe = 0; swipe < 4; swipe++) {
  53 |         await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start, y }] });
  54 |         for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start + (end - start) * step / 8, y }] });
  55 |         await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  56 |       }
  57 |       await expect.poll(() => ruler.evaluate(element => element.scrollLeft + element.clientWidth >= element.scrollWidth - 2), { message: "último dia alcançável por swipe" }).toBe(true);
  58 |       await page.evaluate(() => window.scrollTo(0, 0));
  59 |       const hub = page.getByRole("link", { name: /Voltar ao Hub/ });
  60 |       await expect(hub).toBeVisible();
  61 |       const hubBox = (await hub.boundingBox())!;
  62 |       expect.soft(hubBox.y, "Hub não cortado com scroll no topo").toBeGreaterThanOrEqual(0);
  63 |       expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "página sem overflow horizontal").toBe(true);
  64 |       await testInfo.attach("measurements", { body: JSON.stringify({ initial, ratio, focusClips, hubBox }, null, 2), contentType: "application/json" });
  65 |       await context.close();
  66 |     });
  67 |   }
  68 | }
  69 | 
```