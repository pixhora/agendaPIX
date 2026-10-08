import { expect } from "@playwright/test";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow } from "./helpers";

test.describe("preview de movimento", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("sem violações, com rádio, cópia e estado parado quando o movimento reduz", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto("/preview/motion");
    await expect(page.getByRole("heading", { level: 1, name: "Movimento" })).toBeVisible();
    await page.waitForTimeout(400);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page, "preview movimento");

    await expect(page.locator("#preview-hold")).toHaveText(/\d+ minutos/);
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
    await page.keyboard.press("ArrowRight");
    await expect(duration.getByRole("radio", { name: "30 min" })).toBeChecked();
    await duration.getByText("45 min", { exact: true }).click();
    await expect(duration.getByRole("radio", { name: "45 min" })).toBeChecked();

    const appearance = page.getByRole("radiogroup", { name: "Aparência" });
    await appearance.getByText("Escuro", { exact: true }).click();
    await expect(page.getByText("Aparência selecionada: Escuro.")).toBeVisible();

    await page.getByRole("button", { name: "Copiar código" }).click();
    await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
    await expect(page.locator(".motion-focus [aria-live='polite']")).toHaveText("Copiado");
    await expect(page.getByRole("button", { name: "Copiar código" })).toBeVisible({ timeout: 4000 });
  });

  test("com movimento, a reserva e a marca entram na tela", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
    await page.goto("/preview/motion");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page, "preview movimento escuro");
    await page.getByTestId("booking-island").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("booking-island")).toHaveAttribute("data-inview", "");
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
