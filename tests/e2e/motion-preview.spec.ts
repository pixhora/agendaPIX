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
    await expect(page.getByRole("status").first()).toContainText("Carregando…");
    await expect(page.getByTestId("booking-island")).not.toHaveAttribute("data-inview", "");
    await expect(page.getByTestId("grade-loader").first()).not.toHaveAttribute("data-inview", "");

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
    await page.getByTestId("grade-loader").first().scrollIntoViewIfNeeded();
    await expect(page.getByTestId("grade-loader").first()).toHaveAttribute("data-inview", "");
  });
});
