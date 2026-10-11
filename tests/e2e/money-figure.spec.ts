import { expect } from "@playwright/test";
import { contrastRatio, expectNoAxeViolations, expectNoHorizontalOverflow, test } from "./helpers";

type Figure = {
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  color: string;
  mid: number;
};

function sameFamily(a: string, b: string) {
  return a.split(",")[0].replaceAll('"', "") === b.split(",")[0].replaceAll('"', "");
}

test.describe("campo de dinheiro: prefixo e valor na mesma figura", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const theme of ["light", "dark"] as const) {
    test(`preço e sinal no tema ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
      await page.goto("/onboarding");
      await expect(page.getByRole("heading", { name: "Sua loja" })).toBeVisible();

      const read = async (id: string) => page.locator(`#${id}`).evaluate((input) => {
        const prefix = input.parentElement?.querySelector("[data-money-prefix]");
        if (!prefix) throw new Error("prefixo R$ ausente");
        const box = (element: Element) => {
          const computed = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            fontFamily: computed.fontFamily,
            color: computed.color,
            mid: (rect.top + rect.bottom) / 2,
          };
        };
        const placeholder = getComputedStyle(input, "::placeholder");
        return {
          prefix: box(prefix),
          input: box(input),
          placeholder: {
            fontSize: placeholder.fontSize,
            fontWeight: placeholder.fontWeight,
            fontFamily: placeholder.fontFamily,
            color: placeholder.color,
          },
        };
      });

      const assertFigure = (figure: { prefix: Figure; input: Figure; placeholder: { fontSize: string; fontWeight: string; fontFamily: string; color: string } }, filled: boolean) => {
        expect(figure.prefix.fontSize).toBe("16px");
        expect(figure.input.fontSize).toBe(figure.prefix.fontSize);
        expect(figure.placeholder.fontSize).toBe(figure.prefix.fontSize);
        expect(figure.prefix.fontWeight).toBe("400");
        expect(figure.input.fontWeight).toBe(figure.prefix.fontWeight);
        expect(figure.placeholder.fontWeight).toBe(figure.prefix.fontWeight);
        expect(sameFamily(figure.prefix.fontFamily, figure.input.fontFamily)).toBe(true);
        expect(sameFamily(figure.prefix.fontFamily, figure.placeholder.fontFamily)).toBe(true);
        expect(Math.abs(figure.prefix.mid - figure.input.mid)).toBeLessThanOrEqual(1);
        if (filled) expect(figure.prefix.color).toBe(figure.input.color);
        else expect(figure.prefix.color).toBe(figure.placeholder.color);
      };

      const price = page.locator("#store-price");
      await price.scrollIntoViewIfNeeded();
      assertFigure(await read("store-price"), false);
      await price.focus();
      assertFigure(await read("store-price"), false);
      await price.pressSequentially("2500");
      await expect(price).toHaveValue("25,00");
      assertFigure(await read("store-price"), true);

      await page.getByRole("checkbox", { name: "Cobrar sinal no Pix" }).click();
      const deposit = page.locator("#store-deposit");
      await expect(deposit).toBeVisible();
      assertFigure(await read("store-deposit"), false);
      await deposit.pressSequentially("1000");
      await expect(deposit).toHaveValue("10,00");
      assertFigure(await read("store-deposit"), true);

      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page, `onboarding ${theme} 375`);
    });
  }
});

test.describe("select de duração: texto legível no tema escuro", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("opção e controle fechado passam de 4,5:1", async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), "dark");
    await page.goto("/onboarding");
    const select = page.getByRole("combobox", { name: "Duração" });
    await select.click();
    const option = page.getByRole("option", { name: "30 min" });
    const open = await option.evaluate((element) => {
      const menu = element.closest("[data-slot=select-content]");
      return {
        color: getComputedStyle(element).color,
        surface: menu ? getComputedStyle(menu).backgroundColor : getComputedStyle(element).backgroundColor,
      };
    });
    expect(open.surface).not.toBe("rgba(0, 0, 0, 0)");
    expect(contrastRatio(open.color, open.surface)).toBeGreaterThanOrEqual(4.5);
    await option.click();
    const closed = await select.evaluate((element) => ({
      color: getComputedStyle(element).color,
      surface: getComputedStyle(element).backgroundColor,
    }));
    expect(closed.surface).not.toBe("rgba(0, 0, 0, 0)");
    expect(contrastRatio(closed.color, closed.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
