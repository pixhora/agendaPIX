import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 1280]) {
    test(`régua Corte + escova: ${width}px ${colorScheme}`, async ({ browser, baseURL }, testInfo) => {
      const context = await browser.newContext({ baseURL, viewport: { width, height: 812 }, colorScheme, hasTouch: true, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto("/preview/booking");
      await page.getByRole("radio", { name: /Corte \+ escova/ }).click();
      await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
      const ruler = page.getByRole("group", { name: "Selecione uma data" });
      const days = ruler.getByRole("button");
      const fade = page.getByRole("region", { name: "Régua de datas disponíveis" }).locator('[aria-hidden="true"]');
      const gradient = await fade.evaluate(element => ({ backgroundImage: getComputedStyle(element).backgroundImage, width: element.getBoundingClientRect().width, pointerEvents: getComputedStyle(element).pointerEvents }));
      expect.soft(gradient.backgroundImage, "overflow exige gradiente renderizado").toContain("gradient");
      expect.soft(gradient.width).toBeGreaterThan(0);
      expect.soft(gradient.pointerEvents).toBe("none");
      await expect(days.first().locator("span").last()).toHaveText("5 vagas");
      await page.screenshot({ path: testInfo.outputPath("initial.png"), fullPage: false });
      const initial = await ruler.evaluate((element) => {
        const style = getComputedStyle(element);
        return { scrollbarWidth: style.scrollbarWidth, webkitDisplay: getComputedStyle(element, "::-webkit-scrollbar").display, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
      });
      expect.soft(initial.scrollbarWidth === "none" || initial.webkitDisplay === "none", "scrollbar nativa deve ficar oculta").toBe(true);
      const ratio = await days.first().locator("span").last().evaluate((element) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const drawing = canvas.getContext("2d")!;
        const rgba = (value: string) => {
          drawing.clearRect(0, 0, 1, 1);
          drawing.fillStyle = value;
          drawing.fillRect(0, 0, 1, 1);
          const channels = Array.from(drawing.getImageData(0, 0, 1, 1).data);
          return [...channels.slice(0, 3), channels[3] / 255];
        };
        const composite = (top: number[], bottom: number[]) => top.slice(0, 3).map((value, i) => value * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1)));
        let background = [255, 255, 255];
        const ancestors: Element[] = [];
        for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
        for (const ancestor of ancestors) background = composite(rgba(getComputedStyle(ancestor).backgroundColor), background);
        const foreground = composite(rgba(getComputedStyle(element).color), background);
        const luminance = (rgb: number[]) => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const a = luminance(foreground), b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect.soft(ratio, "badge ativo 5 vagas exige contraste AA 4.5:1").toBeGreaterThanOrEqual(4.5);
      await days.first().focus();
      const focusClips: number[] = [];
      for (let i = 0; i < await days.count(); i++) {
        await expect(days.nth(i)).toBeFocused();
        // Aguarda a rolagem suave nativa antes de medir o recorte de foco.
        await expect.configure({ soft: true }).poll(() => days.nth(i).evaluate(element => {
          const box = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect();
          return box.left >= parent.left - 1 && box.right <= parent.right + 1;
        }), { timeout: 1000 }).toBe(true);
        const geometry = await days.nth(i).evaluate((element) => {
          const box = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect(), style = getComputedStyle(element);
          const outline = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
          return { visible: box.left >= parent.left - 1 && box.right <= parent.right + 1, clipped: box.left - outline < parent.left - 1 || box.right + outline > parent.right + 1 || box.top - outline < parent.top - 1 || box.bottom + outline > parent.bottom + 1 };
        });
        expect.soft(geometry.visible, `dia ${i} alcançável por Tab`).toBe(true);
        if (geometry.clipped) focusClips.push(i);
        if (i < await days.count() - 1) await page.keyboard.press("Tab");
      }
      await page.screenshot({ path: testInfo.outputPath("last-day-focus.png") });
      expect.soft(focusClips, "foco não deve ser recortado pela régua").toEqual([]);
      await ruler.evaluate(element => { element.scrollLeft = 0; });
      await days.first().focus();
      for (let press = 0; press < 20; press++) await page.keyboard.press("ArrowRight");
      await expect.configure({ soft: true }).poll(() => ruler.evaluate(element => element.scrollLeft > 0), { message: "ArrowRight rola régua" }).toBe(true);
      const afterRight = await ruler.evaluate(element => element.scrollLeft);
      for (let press = 0; press < 20; press++) await page.keyboard.press("ArrowLeft");
      await expect.configure({ soft: true }).poll(() => ruler.evaluate(element => element.scrollLeft), { message: "ArrowLeft retorna régua" }).toBeLessThan(afterRight);
      await ruler.evaluate(element => { element.scrollLeft = 0; });
      const box = (await ruler.boundingBox())!;
      const cdp = await context.newCDPSession(page);
      const start = box.x + box.width - 15, end = box.x + 15, y = box.y + box.height / 2;
      for (let swipe = 0; swipe < 4; swipe++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start, y }] });
        for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start + (end - start) * step / 8, y }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      }
      await expect.poll(() => ruler.evaluate(element => element.scrollLeft + element.clientWidth >= element.scrollWidth - 2), { message: "último dia alcançável por swipe" }).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      const hub = page.getByRole("link", { name: /Voltar ao Hub/ });
      await expect(hub).toBeVisible();
      const hubBox = (await hub.boundingBox())!;
      expect.soft(hubBox.y, "Hub não cortado com scroll no topo").toBeGreaterThanOrEqual(0);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "página sem overflow horizontal").toBe(true);
      await testInfo.attach("measurements", { body: JSON.stringify({ initial, ratio, focusClips, hubBox, gradient, afterRight }, null, 2), contentType: "application/json" });
      console.log(JSON.stringify({ width, colorScheme, initial, ratio, gradient, focusClips, afterRight, hubTop: hubBox.y }));
      await context.close();
    });
  }
}
