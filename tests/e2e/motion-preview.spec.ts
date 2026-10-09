import { expect, type Locator, type Page } from "@playwright/test";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow } from "./helpers";

async function expectFocusRing(locator: Locator, color: string) {
  const ring = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset, color: style.outlineColor };
  });
  expect(ring).toEqual({ style: "solid", width: "2px", offset: "2px", color });
}

async function settleFiniteAnimations(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const pending = document.getAnimations().filter((animation) => {
      const iterations = animation.effect?.getComputedTiming().iterations;
      return iterations !== Infinity;
    });
    await Promise.all(pending.map((animation) => animation.finished));
  });
}

test.describe("preview de movimento", () => {
  test.describe.configure({ retries: 0 });
  test.beforeEach(async ({ context, browserName }) => {
    if (browserName !== "chromium") return;
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("sem violações, com rádio, cópia e estado parado quando o movimento reduz", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto("/preview/motion");
    await expect(page.getByRole("heading", { level: 1, name: "Movimento" })).toBeVisible();
    await page.waitForTimeout(400);
    await expectNoHorizontalOverflow(page);
    await settleFiniteAnimations(page);
    await expectNoAxeViolations(page, "preview movimento");

    await expect(page.locator("#preview-hold")).toHaveText("30 minutos");
    await expect(page.getByTestId("booking-island")).toContainText("sex, 9 out, 14:00");
    await expect(page.locator("#preview-deposit")).toHaveText(/R\$\s*15,00/);
    const loader = page.locator("[data-testid='grade-loader'].is-loop").first();
    await expect(loader).toHaveAttribute("role", "status");
    await expect(loader).toHaveText("Carregando");
    await expect(loader.locator(".grade-svg")).toHaveAttribute("aria-hidden", "true");
    await expect(loader.locator(".grade-ring")).toHaveCSS("animation-name", "none");
    await expect(loader.locator(".grade-ring")).toHaveCSS("opacity", "1");
    await expect(loader.locator(".grade-stem")).toHaveCSS("opacity", "1");
    await expect(page.locator("[data-testid='grade-loader']:not(.is-loop)").first()).not.toHaveAttribute("role", "status");
    await expect(page.getByTestId("booking-island")).not.toHaveAttribute("data-inview", "");
    await expect(page.getByTestId("booking-island")).not.toHaveAttribute("data-armed", "");

    const duration = page.getByRole("radiogroup", { name: "Duração do serviço" });
    await duration.getByRole("radio", { name: "15 min" }).focus();
    await expectFocusRing(duration, "rgb(11, 11, 12)");
    await page.keyboard.press("ArrowRight");
    await expect(duration.getByRole("radio", { name: "30 min" })).toBeChecked();
    await page.keyboard.press("Shift+Tab");
    const copyButton = page.getByRole("button", { name: "Copiar código" });
    await expect(copyButton).toBeFocused();
    const copyWrap = page.locator(".copy-control");
    await expect(copyWrap).not.toHaveClass(/motion-focus/);
    const rings = await page.evaluate(() => {
      const button = document.activeElement;
      const wrap = button?.closest(".copy-control");
      return {
        button: button ? getComputedStyle(button).outlineStyle : "",
        wrap: wrap ? getComputedStyle(wrap).outlineStyle : "",
      };
    });
    expect(rings).toEqual({ button: "solid", wrap: "none" });
    await duration.getByText("45 min", { exact: true }).click();
    await expect(duration.getByRole("radio", { name: "45 min" })).toBeChecked();

    const appearance = page.getByRole("radiogroup", { name: "Aparência" });
    await appearance.getByText("Escuro", { exact: true }).click();
    await expect(page.getByText("Aparência selecionada: Escuro.")).toBeVisible();

    await page.getByRole("button", { name: "Copiar código" }).click();
    await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
    await expect(page.locator(".copy-control [aria-live='polite']")).toHaveText("Copiado");
    await expect(page.getByRole("button", { name: "Copiar código" })).toBeVisible({ timeout: 4000 });
  });

  test("com movimento, a reserva e a marca entram na tela", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
    await page.goto("/preview/motion");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page);
    const island = page.getByTestId("booking-island");
    await island.scrollIntoViewIfNeeded();
    await expect(island).toHaveAttribute("data-inview", "");
    await settleFiniteAnimations(page);
    await expectNoAxeViolations(page, "preview movimento escuro");
    const duration = page.getByRole("radiogroup", { name: "Duração do serviço" });
    await duration.getByRole("radio", { name: "15 min" }).focus();
    await expectFocusRing(duration, "rgb(63, 208, 190)");
    const loader = page.locator("[data-testid='grade-loader'].is-loop").first();
    await loader.scrollIntoViewIfNeeded();
    await expect(loader).toHaveClass(/is-loop/);
    const sweep = await loader.locator(".grade-conic").evaluate((el) => {
      const style = getComputedStyle(el);
      return { name: style.animationName, count: style.animationIterationCount };
    });
    expect(sweep).toEqual({ name: "grade-aro-sweep", count: "infinite" });
  });
});
