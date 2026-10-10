import { expect } from "@playwright/test";
import { test } from "./helpers";

/**
 * Regressão visual: landing e cadastro público em 4 larguras e 2 temas.
 * Roda só no projeto desktop (o viewport é trocado aqui). Baselines em tests/e2e/visual.spec.ts-snapshots.
 */
const widths = [375, 390, 768, 1440] as const;
const pages = [
  { name: "landing", path: "/" },
  { name: "cadastro", path: "/onboarding" },
] as const;

test.describe("regressão visual", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const theme of ["light", "dark"] as const) {
    for (const width of widths) {
      for (const target of pages) {
        test(`${target.name} ${theme} ${width}px`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== "desktop", "projeto desktop troca o viewport");
          await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
          await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
          await page.goto(target.path, { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          await expect(page).toHaveScreenshot(`${target.name}-${theme}-${width}.png`, {
            fullPage: false,
            animations: "disabled",
            maxDiffPixelRatio: 0.01,
          });
        });
      }
    }
  }
});
