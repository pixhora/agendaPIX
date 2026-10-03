import { expect, test, type Locator } from "@playwright/test";

async function contrast(locator: Locator) {
  return locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const layers: number[][] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      layers.push(rgba(getComputedStyle(node).backgroundColor));
    }
    const blend = (base: number[], layer: number[]) => base.map((channel, index) => channel * (1 - layer[3] / 255) + layer[index] * layer[3] / 255);
    const background = layers.reverse().reduce(blend, [255, 255, 255]);
    const foreground = blend(background, rgba(getComputedStyle(element).color));
    const luminance = (channels: number[]) => channels.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test("nova direção: contraste do sinal no booking claro", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/preview/booking");
  const deposit = page.getByText("Sinal: R$ 25,00", { exact: true });
  await expect(deposit).toBeVisible();
  await page.screenshot({ path: info.outputPath("booking-light-375.png"), fullPage: true });
  expect(await contrast(deposit)).toBeGreaterThanOrEqual(4.5);
});

test("nova direção: contraste do hero escuro e CTA mobile", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/preview/landing");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await page.screenshot({ path: info.outputPath("landing-dark-375.png"), fullPage: true });
  expect.soft(await contrast(heading)).toBeGreaterThanOrEqual(3);
  const cta = page.getByRole("link", { name: "Testar Booking", exact: true });
  expect.soft((await cta.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await cta.focus();
  const focus = await cta.evaluate((element) => {
    const style = getComputedStyle(element);
    return (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
  });
  expect.soft(focus).toBe(true);
});

test("preview: teclado e reduced-motion no booking", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/booking");
  const service = page.getByRole("radio", { name: /Corte feminino/ });
  await service.focus();
  await service.press("ArrowRight");
  await expect.soft(page.getByRole("radio", { name: /Corte \+ escova/ })).toHaveAttribute("aria-checked", "true");
  const next = page.getByRole("button", { name: "Continuar para escolher horário" });
  await next.focus();
  const timing = await next.evaluate((element) => {
    const style = getComputedStyle(element);
    return { transition: parseFloat(style.transitionDuration), animation: parseFloat(style.animationDuration) };
  });
  expect(timing.transition).toBeLessThanOrEqual(0.001);
  expect(timing.animation).toBeLessThanOrEqual(0.001);
  await next.press("Enter");
  await expect(page.getByRole("heading", { name: "Escolha o horário" })).toBeVisible();
});

test("preview: valor Pix legível no modo claro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/preview/booking");
  await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  await page.getByRole("radiogroup", { name: "Horários disponíveis", exact: true }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Preencher meus dados" }).click();
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
  const amount = page.getByText("R$ 25,00", { exact: true });
  await expect(amount).toBeVisible();
  expect(await contrast(amount)).toBeGreaterThanOrEqual(3);
});
