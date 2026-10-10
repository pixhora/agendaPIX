import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow, readMeta } from "./helpers";

const meta = readMeta();
const lead = "Agenda com sinal no Pix feita no AgendaPix.";
const linkName = "Crie a sua grátis";
const shotsDir = "/opt/cursor/artifacts/screenshots";

test.use({ storageState: { cookies: [], origins: [] } });

function hrefFor(campaign: "pagina_publica" | "reserva_confirmada") {
  return `/?utm_source=agendapix&utm_medium=rodape&utm_campaign=${campaign}`;
}

async function expectPoweredBy(page: Page, campaign: "pagina_publica" | "reserva_confirmada") {
  const footer = page.getByTestId("powered-by-footer");
  await expect(footer).toBeVisible();
  await expect(footer).toContainText(lead);
  const link = footer.getByRole("link", { name: linkName });
  await expect(link).toHaveAttribute("href", hrefFor(campaign));
  const box = await link.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  const params = new URL(await link.getAttribute("href") ?? "", "https://www.agendapix.dev.br").searchParams;
  expect([...params.keys()].sort()).toEqual(["utm_campaign", "utm_medium", "utm_source"]);
}

async function expectFooterAbsent(page: Page) {
  await expect(page.getByTestId("powered-by-footer")).toHaveCount(0);
  await expect(page.getByRole("link", { name: linkName })).toHaveCount(0);
}

async function withPool<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function fillCustomer(page: Page, name: string) {
  await page.locator("#customer-name").fill(name);
  await page.locator("#customer-phone").fill("11987654321");
  const cpf = page.locator("#customer-cpf");
  if (await cpf.isVisible()) await cpf.fill("52998224725");
}

async function openPublicPage(page: Page) {
  await page.goto(`/${meta.businessASlug}`);
  await expect(page.getByRole("heading", { level: 1, name: "Negócio E2E A" })).toBeVisible();
}

async function reachPix(page: Page, name: string) {
  await openPublicPage(page);
  await page.getByRole("radiogroup", { name: /Serviços/ }).getByRole("radio", { name: /Corte E2E/ }).click();
  await page.getByRole("button", { name: /Escolher horário/ }).filter({ visible: true }).first().click();
  const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
  const days = page.getByTestId("day-option");
  await expect(days.first()).toBeVisible();
  const dayCount = await days.count();
  for (let index = 0; index < dayCount; index += 1) {
    if (await slots.first().waitFor({ state: "visible", timeout: 6_000 }).then(() => true, () => false)) break;
    await days.nth(index + 1).click();
  }
  await slots.first().click();
  await page.getByRole("button", { name: /Continuar com \d{2}:\d{2}/ }).filter({ visible: true }).first().click();
  await fillCustomer(page, name);
  await page.getByRole("button", { name: /Gerar Pix de R\$\s?10,00/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: /Copiar código/ })).toBeVisible({ timeout: 20_000 });
}

async function confirmLatestPayment(page: Page, request: APIRequestContext, suffix: string) {
  const payment = await withPool(async (pool) => {
    const { rows } = await pool.query<{ external_id: string; amount_cents: number }>(
      `select p.external_id, p.amount_cents
       from payments p join businesses b on b.id = p.business_id
       where b.slug = $1 order by p.created_at desc limit 1`,
      [meta.businessASlug],
    );
    return rows[0];
  });
  expect(payment?.external_id).toBeTruthy();
  const body = JSON.stringify({
    eventId: `evt-footer-${suffix}-${Date.now()}`,
    type: "payment.paid",
    externalId: payment.external_id,
    amountCents: payment.amount_cents,
    paidAt: new Date().toISOString(),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", process.env.FAKE_WEBHOOK_SECRET ?? "").update(`${timestamp}.${body}`).digest("hex");
  const webhook = await request.post("/api/webhooks/payments/fake", {
    headers: { "content-type": "application/json", "x-fake-timestamp": timestamp, "x-fake-signature": signature },
    data: body,
  });
  expect(webhook.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 20_000 });
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => {
    localStorage.setItem("agenda-theme", value);
    const root = document.documentElement;
    root.classList.toggle("dark", value === "dark");
    root.classList.toggle("light", value === "light");
    root.style.colorScheme = value;
  }, theme);
  await expect(page.locator("html")).toHaveClass(theme === "dark" ? /\bdark\b/ : /\blight\b/);
}

async function shoot(page: Page, name: string) {
  await page.getByTestId("powered-by-footer").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
}

test("rodapé na página pública, ausente no Pix e presente na confirmação", async ({ page, request }, testInfo) => {
  await openPublicPage(page);
  await expectPoweredBy(page, "pagina_publica");
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, "rodapé na página pública");

  const original = page.viewportSize();
  await page.setViewportSize({ width: 360, height: 780 });
  await expectPoweredBy(page, "pagina_publica");
  await expectNoHorizontalOverflow(page);
  if (original) await page.setViewportSize(original);

  await reachPix(page, `Cliente rodapé ${testInfo.project.name}`);
  await expectFooterAbsent(page);
  await expectNoAxeViolations(page, "tela de Pix sem rodapé AgendaPix");

  await confirmLatestPayment(page, request, testInfo.project.name);
  await expectPoweredBy(page, "reserva_confirmada");
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, "rodapé na reserva confirmada");

  if (process.env.CAPTURE_FOOTER === "1" && testInfo.project.name === "desktop") {
    await mkdir(shotsDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, "light");
    await shoot(page, "rodape-confirmado-desktop-claro.png");
    await setTheme(page, "dark");
    await shoot(page, "rodape-confirmado-desktop-escuro.png");
    await page.setViewportSize({ width: 360, height: 780 });
    await shoot(page, "rodape-confirmado-360-escuro.png");
    await setTheme(page, "light");
    await shoot(page, "rodape-confirmado-360-claro.png");

    await openPublicPage(page);
    await expectPoweredBy(page, "pagina_publica");
    await shoot(page, "rodape-publico-360-claro.png");
    await setTheme(page, "dark");
    await shoot(page, "rodape-publico-360-escuro.png");
    await page.setViewportSize({ width: 1440, height: 900 });
    await shoot(page, "rodape-publico-desktop-escuro.png");
    await setTheme(page, "light");
    await shoot(page, "rodape-publico-desktop-claro.png");
  }
});

test("rodapé em 360 px no tema escuro mantém contraste e não estoura a largura", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("agenda-theme", "dark"));
  await page.setViewportSize({ width: 360, height: 780 });
  await openPublicPage(page);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectPoweredBy(page, "pagina_publica");
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, "rodapé 360 escuro");
});
