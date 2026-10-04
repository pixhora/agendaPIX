import fs from "node:fs";
import { chromium, expect } from "@playwright/test";

// Shell real renderizado no servidor; auth/dados não são objeto desta prova isolada.
const publicHTML = fs.readFileSync("/tmp/agenda-t2-login-public.html", "utf8");
const markup = fs.readFileSync("/tmp/agenda-t2-shell.html", "utf8");
const styles = [...publicHTML.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(([link]) => link.replace('href="/', 'href="http://localhost:3343/')).join("");
const bodyClass = publicHTML.match(/<body class="([^"]*)"/)?.[1] ?? "";
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles}</head><body class="${bodyClass}">${markup}</body></html>`;
const browser = await chromium.launch();
const results = [];
try {
  for (const colorScheme of ["light", "dark"]) {
    for (const width of [375, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 812 }, colorScheme, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("http://localhost:3343/dashboard**", route => route.fulfill({ contentType: "text/html", body: html }));
      await page.goto("http://localhost:3343/dashboard?businessId=business-a");
      await page.evaluate(() => document.fonts.ready);
      const nav = page.getByRole("navigation", { name: "Painel" });
      const links = nav.getByRole("link");
      await expect(links).toHaveCount(4);
      for (let index = 0; index < 4; index++) {
        const link = links.nth(index);
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      if (width < 640) {
        const first = await links.nth(0).boundingBox();
        const second = await links.nth(1).boundingBox();
        const third = await links.nth(2).boundingBox();
        expect(first.y).toBe(second.y);
        expect(third.y).toBeGreaterThan(first.y);
      }
      const select = page.getByRole("combobox");
      await select.focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Abrir negócio" })).toBeFocused();
      for (let index = 0; index < 4; index++) {
        await page.keyboard.press("Tab");
        await expect(links.nth(index)).toBeFocused();
        expect(await links.nth(index).evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `docs/evidencias/dashboard-shell/shell-${width}-${colorScheme}.png`, fullPage: true });
      await page.keyboard.press("Enter");
      await page.waitForURL("http://localhost:3343/dashboard/settings?businessId=business-a");
      expect(errors).toEqual([]);
      results.push({ width, colorScheme, visibleDestinations: 4, touch44: true, keyboard: true, tenantInLink: true, noOverflow: true, reducedMotion: true, pageErrors: 0 });
      await context.close();
    }
  }
  fs.writeFileSync("docs/evidencias/dashboard-shell/results.json", JSON.stringify({ mode: "Shell real SSR e CSS real; documento isolado sem auth/API", results }, null, 2));
  console.log(`${results.length}/6 shell browser OK`);
} finally { await browser.close(); }
