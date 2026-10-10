import { expect } from "@playwright/test";
import { test } from "./helpers";

/** Razão de contraste WCAG entre duas cores rgb()/rgba() do computed style. */
function contrast(a: string, b: string): number {
  const parse = (value: string) => {
    const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (!m) throw new Error(`cor não reconhecida: ${value}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const lum = (rgb: number[]) => {
    const [r, g, b2] = rgb.map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [light, dark] = [lum(parse(a)), lum(parse(b))].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

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
      expect(contrast(style.color, style.background)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
