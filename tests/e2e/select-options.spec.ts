import { expect } from "@playwright/test";
import { contrastRatio, test } from "./helpers";

test.describe("select: opções legíveis nos dois temas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const theme of ["light", "dark"] as const) {
    test(`duração do serviço no tema ${theme} tem contraste AA`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
      await page.goto("/onboarding");
      const select = page.getByRole("combobox", { name: "Duração" });
      await expect(select).toBeVisible();
      const closed = await select.evaluate((element) => ({
        color: getComputedStyle(element).color,
        surface: getComputedStyle(element).backgroundColor,
      }));
      expect(closed.surface).not.toBe("rgba(0, 0, 0, 0)");
      expect(contrastRatio(closed.color, closed.surface)).toBeGreaterThanOrEqual(4.5);

      await select.click();
      const option = page.getByRole("option", { name: "30 min" });
      await expect(option).toBeVisible();
      const open = await option.evaluate((element) => {
        const menu = element.closest("[data-slot=select-content]");
        return {
          color: getComputedStyle(element).color,
          surface: menu ? getComputedStyle(menu).backgroundColor : getComputedStyle(element).backgroundColor,
        };
      });
      expect(open.surface).not.toBe("rgba(0, 0, 0, 0)");
      expect(contrastRatio(open.color, open.surface)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
