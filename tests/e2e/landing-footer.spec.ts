import { expect, test, type Page } from "@playwright/test";

async function expectFooterVisible(page: Page) {
  const footer = page.locator("#rodape");
  await footer.evaluate((element) => element.scrollIntoView({ block: "end", inline: "nearest" }));
  await expect(footer.getByRole("link", { name: "AgendaPix, página inicial" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Como funciona" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Como o cliente agenda" })).toBeVisible();
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

test.describe("barra fixa da landing", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("reserva a altura da barra mais 16 px e some no CTA final ou no rodapé", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "a barra só existe até 767 px");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bar = page.locator("#sticky-cta");

    await page.evaluate(() => {
      const cta = document.getElementById("hero-primary-cta");
      if (!cta) return;
      window.scrollTo(0, cta.getBoundingClientRect().bottom + window.scrollY + 24);
    });
    await expect(bar).toHaveAttribute("data-visible", "false");

    await page.evaluate(() => {
      const hero = document.getElementById("hero");
      if (!hero) return;
      window.scrollTo(0, hero.getBoundingClientRect().bottom + window.scrollY + 24);
    });
    await expect(bar).toHaveAttribute("data-visible", "true");

    await expect.poll(async () => page.evaluate(() => {
      const main = document.getElementById("content");
      const node = document.getElementById("sticky-cta");
      if (!main || !node || node.dataset.visible !== "true") return null;
      const pad = Number.parseFloat(getComputedStyle(main).paddingBottom);
      return pad === node.offsetHeight + 16 ? pad : null;
    })).not.toBeNull();

    await page.locator("#cta-final").evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
    await expect(bar).toHaveAttribute("data-visible", "false");

    await page.evaluate(() => {
      const hero = document.getElementById("hero");
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
