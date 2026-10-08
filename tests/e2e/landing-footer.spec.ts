import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectFooterVisible(page: Page) {
  const footer = page.locator("#rodape");
  await footer.evaluate((element) => element.scrollIntoView({ block: "end", inline: "nearest" }));
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

  test("fica na coluna do celular em 1024, 1280 e 1440", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a largura é definida no próprio teste");
    await page.goto("/");
    const card = page.locator("[aria-hidden='true']").filter({ hasText: "Nova reserva · Ana" });
    const paragraph = page.getByRole("heading", { level: 1 }).locator("xpath=following-sibling::p[1]");
    const example = page.getByRole("link", { name: "Ver uma página de exemplo" });
    const phoneColumn = card.locator("xpath=..");

    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(paragraph).toBeVisible();
      await expect(example).toBeVisible();
      const copy = await box(paragraph);
      const link = await box(example);
      const column = await phoneColumn.boundingBox();
      expect(column, `coluna do celular em ${width}`).not.toBeNull();
      if (width < 1280) {
        await expect(card).toBeHidden();
        continue;
      }
      const floating = await box(card);
      const selected = await box(page.locator("span").filter({ hasText: "15:30" }).filter({ hasText: "Selecionado" }));
      const textColumn = await box(paragraph.locator("xpath=.."));
      expect(overlaps(floating, copy), `parágrafo em ${width}`).toBe(false);
      expect(overlaps(floating, link), `botão de exemplo em ${width}`).toBe(false);
      expect(overlaps(floating, selected), `horário selecionado em ${width}`).toBe(false);
      expect(floating.x - (textColumn.x + textColumn.width), `vão da coluna de texto em ${width}`).toBeGreaterThanOrEqual(16);
      expect(floating.x, `borda esquerda em ${width}`).toBeGreaterThanOrEqual(column!.x - 1);
      expect(floating.x + floating.width, `borda direita em ${width}`).toBeLessThanOrEqual(column!.x + column!.width + 1);
      const date = card.locator("span.whitespace-nowrap");
      const dateBox = await box(date);
      expect(dateBox.height, `data em uma linha em ${width}`).toBeLessThanOrEqual(22);
    }
  });
});

test.describe("dias do celular no hero", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Qua a Sáb ficam na mesma linha", async ({ page }) => {
    await page.goto("/");
    const tops = await page.evaluate(() => {
      const labels = ["Qua 14", "Qui 15", "Sex 16", "Sáb 17"];
      return labels.map((label) => {
        const node = [...document.querySelectorAll("span")].find((element) => element.textContent === label);
        return node ? Math.round(node.getBoundingClientRect().top) : null;
      });
    });
    expect(tops.every((top) => top != null)).toBe(true);
    expect(new Set(tops).size).toBe(1);
    await expect(page.getByText("Dom 18")).toHaveCount(0);
  });
});

test.describe("barra fixa da landing", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("reserva a altura da barra mais 16 px e some no CTA final ou no rodapé", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "a barra só existe até 767 px");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bar = page.locator("#sticky-cta");

    await page.evaluate(() => {
      const hero = document.getElementById("hero-primary-cta");
      if (!hero) return;
      window.scrollTo(0, hero.getBoundingClientRect().bottom + window.scrollY + 24);
    });
    await expect(bar).toHaveAttribute("data-visible", "true");

    const measured = await page.evaluate(() => {
      const main = document.querySelector("main");
      const node = document.getElementById("sticky-cta");
      if (!main || !node) return null;
      return { pad: Number.parseFloat(getComputedStyle(main).paddingBottom), height: node.offsetHeight };
    });
    expect(measured).not.toBeNull();
    expect(measured!.pad).toBe(measured!.height + 16);

    await page.locator("#cta-final").evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
    await expect(bar).toHaveAttribute("data-visible", "false");

    await page.evaluate(() => {
      const hero = document.getElementById("hero-primary-cta");
      if (!hero) return;
      window.scrollTo(0, hero.getBoundingClientRect().bottom + window.scrollY + 24);
    });
    await expect(bar).toHaveAttribute("data-visible", "true");

    await page.locator("#rodape").evaluate((element) => element.scrollIntoView({ block: "end", inline: "nearest" }));
    await expect(bar).toHaveAttribute("data-visible", "false");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar).toHaveAttribute("data-visible", "false");
    const covered = await page.evaluate(() => {
      const node = document.getElementById("sticky-cta");
      const footer = document.getElementById("rodape");
      const questions = document.querySelectorAll("#perguntas-frequentes details");
      const last = questions[questions.length - 1];
      if (!node || !footer || !last) return null;
      const barBox = node.getBoundingClientRect();
      const onScreen = node.dataset.visible === "true" && barBox.top < window.innerHeight && barBox.bottom > 0;
      const hits = (target: Element) => {
        if (!onScreen) return false;
        const rect = target.getBoundingClientRect();
        return rect.top < barBox.bottom && rect.bottom > barBox.top && rect.left < barBox.right && rect.right > barBox.left;
      };
      return { faq: hits(last), footer: hits(footer) };
    });
    expect(covered).toEqual({ faq: false, footer: false });
  });
});
