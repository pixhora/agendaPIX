import { expect } from "@playwright/test";
import { contrastRatio, test } from "./helpers";

test.describe("select nativo: opções legíveis nos dois temas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const theme of ["light", "dark"] as const) {
    test(`duração do serviço no tema ${theme} tem contraste AA nas opções`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
      await page.goto("/onboarding");
      const select = page.locator("select#store-duration");
      await expect(select).toBeVisible();
      const style = await select.locator("option").first().evaluate((option) => {
        const computed = getComputedStyle(option);
        return { color: computed.color, background: computed.backgroundColor };
      });
      expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(contrastRatio(style.color, style.background)).toBeGreaterThanOrEqual(4.5);
      // O menu nativo no Linux fica branco e ignora background-color. Texto claro some.
      expect(contrastRatio(style.color, "rgb(255, 255, 255)")).toBeGreaterThanOrEqual(4.5);
      const closed = await select.evaluate((element) => {
        const shell = element.parentElement;
        return {
          color: getComputedStyle(element).color,
          surface: shell ? getComputedStyle(shell).backgroundColor : getComputedStyle(element).backgroundColor,
        };
      });
      expect(contrastRatio(closed.color, closed.surface)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
