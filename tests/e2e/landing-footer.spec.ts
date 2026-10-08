import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectFooterVisible(page: Page) {
  const footer = page.locator("#rodape");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByRole("link", { name: "AgendaPix, página inicial" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Como funciona" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Página de exemplo" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Preço" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Dúvidas" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Entrar" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Criar agenda grátis" })).toBeVisible();
  await expect(footer.getByText("O sinal cai direto na sua conta Mercado Pago.")).toBeVisible();
  const contentVisibility = await footer.evaluate((element) => getComputedStyle(element).contentVisibility);
  expect(contentVisibility).not.toBe("auto");
}

test.describe("rodapé da landing", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const theme of ["light", "dark"] as const) {
    test(`marca e links visíveis no tema ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
      await expectFooterVisible(page);
    });
  }
});

test.describe("rodapé da landing sem JavaScript", () => {
  test.use({ javaScriptEnabled: false, storageState: { cookies: [], origins: [] } });

  test("marca e links visíveis com movimento reduzido", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expectFooterVisible(page);
  });
});

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

test.describe("cartão do hero", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("fica na coluna do celular em 1024, 1280 e 1440", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[aria-hidden='true']").filter({ hasText: "Nova reserva · Ana" });
    const paragraph = page.getByText("o valor cai direto na sua conta Mercado Pago");
    const example = page.getByRole("link", { name: "Ver uma página de exemplo" });
    const phoneColumn = page.locator("section").first().locator(":scope > div > div").nth(1);

    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const copy = await box(paragraph);
      const link = await box(example);
      const column = await phoneColumn.boundingBox();
      expect(column, `coluna do celular em ${width}`).not.toBeNull();
      if (width < 1280) {
        await expect(card).toBeHidden();
        continue;
      }
      const floating = await box(card);
      expect(overlaps(floating, copy), `parágrafo em ${width}`).toBe(false);
      expect(overlaps(floating, link), `botão de exemplo em ${width}`).toBe(false);
      expect(floating.x, `borda esquerda em ${width}`).toBeGreaterThanOrEqual(column!.x - 1);
      expect(floating.x + floating.width, `borda direita em ${width}`).toBeLessThanOrEqual(column!.x + column!.width + 1);
    }
  });
});
