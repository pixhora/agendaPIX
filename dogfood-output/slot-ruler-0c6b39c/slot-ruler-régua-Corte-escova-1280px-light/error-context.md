# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: slot-ruler.spec.ts >> régua Corte + escova: 1280px light
- Location: tests/qa/slot-ruler.spec.ts:5:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 1000ms exceeded while waiting on the predicate
```

```
Error: dia 4 alcançável por Tab

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
+   4,
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
          - group "Selecione uma data" [ref=e42]:
            - button "Hoje 03/10 5 vagas" [active] [pressed] [ref=e43]:
              - generic [ref=e44]: Hoje
              - generic [ref=e45]: 03/10
              - generic [ref=e46]: 5 vagas
            - button "Amanhã 04/10 5 vagas" [ref=e47]:
              - generic [ref=e48]: Amanhã
              - generic [ref=e49]: 04/10
              - generic [ref=e50]: 5 vagas
            - button "SEG 05/10 5 vagas" [ref=e51]:
              - generic [ref=e52]: SEG
              - generic [ref=e53]: 05/10
              - generic [ref=e54]: 5 vagas
            - button "TER 06/10 5 vagas" [ref=e55]:
              - generic [ref=e56]: TER
              - generic [ref=e57]: 06/10
              - generic [ref=e58]: 5 vagas
            - button "QUA 07/10 5 vagas" [ref=e59]:
              - generic [ref=e60]: QUA
              - generic [ref=e61]: 07/10
              - generic [ref=e62]: 5 vagas
            - button "QUI 08/10 5 vagas" [ref=e63]:
              - generic [ref=e64]: QUI
              - generic [ref=e65]: 08/10
              - generic [ref=e66]: 5 vagas
            - button "SEX 09/10 5 vagas" [ref=e67]:
              - generic [ref=e68]: SEX
              - generic [ref=e69]: 09/10
              - generic [ref=e70]: 5 vagas
        - region "Horários disponíveis no dia" [ref=e71]:
          - radiogroup "Horários disponíveis" [ref=e72]:
            - radio "11:30" [checked] [ref=e73]
            - radio "13:30" [ref=e74]
            - radio "15:30" [ref=e75]
            - radio "16:30" [ref=e76]
            - radio "17:30" [ref=e77]
        - generic [ref=e78]:
          - button "Voltar" [ref=e79] [cursor=pointer]
          - button "Preencher meus dados" [ref=e80] [cursor=pointer]
      - contentinfo [ref=e81]: 🔒 Ambiente de Preview determinístico com dados locais.
    - complementary "Controles do Modo Preview" [ref=e82]:
      - button "MODO PREVIEW ▾" [ref=e83]:
        - generic [ref=e85]: MODO PREVIEW
        - generic [ref=e86]: ▾
  - button "Open Next.js Dev Tools" [ref=e92] [cursor=pointer]
  - alert [ref=e96]
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
  11 |       const ruler = page.getByRole("group", { name: "Selecione uma data" });
  12 |       const days = ruler.getByRole("button");
  13 |       const fade = page.getByRole("region", { name: "Régua de datas disponíveis" }).locator('[aria-hidden="true"]');
  14 |       const gradient = await fade.evaluate(element => ({ backgroundImage: getComputedStyle(element).backgroundImage, width: element.getBoundingClientRect().width, pointerEvents: getComputedStyle(element).pointerEvents }));
  15 |       expect.soft(gradient.backgroundImage, "overflow exige gradiente renderizado").toContain("gradient");
  16 |       expect.soft(gradient.width).toBeGreaterThan(0);
  17 |       expect.soft(gradient.pointerEvents).toBe("none");
  18 |       await expect(days.first().locator("span").last()).toHaveText("5 vagas");
  19 |       await page.screenshot({ path: testInfo.outputPath("initial.png"), fullPage: false });
  20 |       const initial = await ruler.evaluate((element) => {
  21 |         const style = getComputedStyle(element);
  22 |         return { scrollbarWidth: style.scrollbarWidth, webkitDisplay: getComputedStyle(element, "::-webkit-scrollbar").display, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
  23 |       });
  24 |       expect.soft(initial.scrollbarWidth === "none" || initial.webkitDisplay === "none", "scrollbar nativa deve ficar oculta").toBe(true);
  25 |       const ratio = await days.first().locator("span").last().evaluate((element) => {
  26 |         const canvas = document.createElement("canvas");
  27 |         canvas.width = canvas.height = 1;
  28 |         const drawing = canvas.getContext("2d")!;
  29 |         const rgba = (value: string) => {
  30 |           drawing.clearRect(0, 0, 1, 1);
  31 |           drawing.fillStyle = value;
  32 |           drawing.fillRect(0, 0, 1, 1);
  33 |           const channels = Array.from(drawing.getImageData(0, 0, 1, 1).data);
  34 |           return [...channels.slice(0, 3), channels[3] / 255];
  35 |         };
  36 |         const composite = (top: number[], bottom: number[]) => top.slice(0, 3).map((value, i) => value * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1)));
  37 |         let background = [255, 255, 255];
  38 |         const ancestors: Element[] = [];
  39 |         for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
  40 |         for (const ancestor of ancestors) background = composite(rgba(getComputedStyle(ancestor).backgroundColor), background);
  41 |         const foreground = composite(rgba(getComputedStyle(element).color), background);
  42 |         const luminance = (rgb: number[]) => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  43 |         const a = luminance(foreground), b = luminance(background);
  44 |         return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  45 |       });
  46 |       expect.soft(ratio, "badge ativo 5 vagas exige contraste AA 4.5:1").toBeGreaterThanOrEqual(4.5);
  47 |       await days.first().focus();
  48 |       const focusClips: number[] = [];
  49 |       for (let i = 0; i < await days.count(); i++) {
  50 |         await expect(days.nth(i)).toBeFocused();
  51 |         // Aguarda a rolagem suave nativa antes de medir o recorte de foco.
  52 |         await expect.configure({ soft: true }).poll(() => days.nth(i).evaluate(element => {
  53 |           const box = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect();
  54 |           return box.left >= parent.left - 1 && box.right <= parent.right + 1;
  55 |         }), { timeout: 1000 }).toBe(true);
  56 |         const geometry = await days.nth(i).evaluate((element) => {
  57 |           const box = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect(), style = getComputedStyle(element);
  58 |           const outline = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
  59 |           return { visible: box.left >= parent.left - 1 && box.right <= parent.right + 1, clipped: box.left - outline < parent.left - 1 || box.right + outline > parent.right + 1 || box.top - outline < parent.top - 1 || box.bottom + outline > parent.bottom + 1 };
  60 |         });
  61 |         expect.soft(geometry.visible, `dia ${i} alcançável por Tab`).toBe(true);
  62 |         if (geometry.clipped) focusClips.push(i);
  63 |         if (i < await days.count() - 1) await page.keyboard.press("Tab");
  64 |       }
  65 |       await page.screenshot({ path: testInfo.outputPath("last-day-focus.png") });
> 66 |       expect.soft(focusClips, "foco não deve ser recortado pela régua").toEqual([]);
     |                                                                         ^ Error: foco não deve ser recortado pela régua
  67 |       await ruler.evaluate(element => { element.scrollLeft = 0; });
  68 |       await days.first().focus();
  69 |       for (let press = 0; press < 20; press++) await page.keyboard.press("ArrowRight");
  70 |       await expect.configure({ soft: true }).poll(() => ruler.evaluate(element => element.scrollLeft > 0), { message: "ArrowRight rola régua" }).toBe(true);
  71 |       const afterRight = await ruler.evaluate(element => element.scrollLeft);
  72 |       for (let press = 0; press < 20; press++) await page.keyboard.press("ArrowLeft");
  73 |       await expect.configure({ soft: true }).poll(() => ruler.evaluate(element => element.scrollLeft), { message: "ArrowLeft retorna régua" }).toBeLessThan(afterRight);
  74 |       await ruler.evaluate(element => { element.scrollLeft = 0; });
  75 |       const box = (await ruler.boundingBox())!;
  76 |       const cdp = await context.newCDPSession(page);
  77 |       const start = box.x + box.width - 15, end = box.x + 15, y = box.y + box.height / 2;
  78 |       for (let swipe = 0; swipe < 4; swipe++) {
  79 |         await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start, y }] });
  80 |         for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start + (end - start) * step / 8, y }] });
  81 |         await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  82 |       }
  83 |       await expect.poll(() => ruler.evaluate(element => element.scrollLeft + element.clientWidth >= element.scrollWidth - 2), { message: "último dia alcançável por swipe" }).toBe(true);
  84 |       await page.evaluate(() => window.scrollTo(0, 0));
  85 |       const hub = page.getByRole("link", { name: /Voltar ao Hub/ });
  86 |       await expect(hub).toBeVisible();
  87 |       const hubBox = (await hub.boundingBox())!;
  88 |       expect.soft(hubBox.y, "Hub não cortado com scroll no topo").toBeGreaterThanOrEqual(0);
  89 |       expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "página sem overflow horizontal").toBe(true);
  90 |       await testInfo.attach("measurements", { body: JSON.stringify({ initial, ratio, focusClips, hubBox, gradient, afterRight }, null, 2), contentType: "application/json" });
  91 |       console.log(JSON.stringify({ width, colorScheme, initial, ratio, gradient, focusClips, afterRight, hubTop: hubBox.y }));
  92 |       await context.close();
  93 |     });
  94 |   }
  95 | }
  96 | 
```