import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { Pool } from "pg";
import { test, readMeta, ownerStorageState } from "./helpers";

const PHASE = (process.env.ICONS_SHOT_PHASE === "after" ? "after" : "before") as "before" | "after";
const OUT = `/workspace/agendaPIX-screens/icons/${PHASE}`;

async function withPool<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function latestPayment(slug: string) {
  return withPool(async (pool) => {
    const { rows } = await pool.query<{ external_id: string; amount_cents: number }>(
      `select p.external_id, p.amount_cents
       from payments p join businesses b on b.id = p.business_id
       where b.slug = $1 order by p.created_at desc limit 1`,
      [slug],
    );
    return rows[0];
  });
}

async function shot(page: import("@playwright/test").Page, name: string) {
  const project = test.info().project.name; // mobile | desktop
  const dir = path.join(OUT, project);
  await mkdir(dir, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

const meta = readMeta();

test.describe.configure({ mode: "serial" });

test("captura booking público (serviço → confirmado)", async ({ page, request }, testInfo) => {
  const slug = meta.businessASlug;
  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "01-slug-servico");

  await page.getByRole("radiogroup", { name: /Serviços/ }).getByRole("radio").first().click();
  await page.getByRole("button", { name: /Escolher horário/ }).filter({ visible: true }).first().click();

  const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
  const days = page.getByTestId("day-option");
  await expect(days.first()).toBeVisible();
  const dayCount = await days.count();
  for (let i = 0; i < dayCount; i += 1) {
    if (await slots.first().waitFor({ state: "visible", timeout: 6_000 }).then(() => true, () => false)) break;
    if (i + 1 < dayCount) await days.nth(i + 1).click();
  }
  await shot(page, "02-slug-horario");

  await slots.first().click();
  await page.getByRole("button", { name: /Continuar com \d{2}:\d{2}/ }).filter({ visible: true }).first().click();
  await page.locator("#customer-name").fill(`Cliente Icons ${testInfo.project.name}`);
  await page.locator("#customer-phone").fill("11987654321");
  await page.locator("#customer-cpf").fill("52998224725");
  await shot(page, "03-slug-dados-resumo");

  await page.getByRole("button", { name: /Gerar Pix/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: /Copiar código Pix/ })).toBeVisible({ timeout: 20_000 });
  await shot(page, "04-slug-pix");

  const payment = await latestPayment(slug);
  expect(payment?.external_id).toBeTruthy();
  const body = JSON.stringify({
    eventId: `evt-icons-${Date.now()}-${testInfo.project.name}-${PHASE}`,
    type: "payment.paid",
    externalId: payment!.external_id,
    amountCents: payment!.amount_cents,
    paidAt: new Date().toISOString(),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", process.env.FAKE_WEBHOOK_SECRET ?? "")
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const webhook = await request.post("/api/webhooks/payments/fake", {
    headers: {
      "content-type": "application/json",
      "x-fake-timestamp": timestamp,
      "x-fake-signature": signature,
    },
    data: body,
  });
  expect(webhook.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 20_000 });
  await shot(page, "05-slug-confirmado");
});

test.describe("painel autenticado", () => {
  test.use({ storageState: ownerStorageState });

  test("captura agenda, serviços, clientes, configurações", async ({ page }) => {
    const id = meta.businessAId;
    await page.goto(`/dashboard?businessId=${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, "06-painel-agenda-dia");

    await page.goto(`/dashboard?businessId=${id}&view=week`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, "07-painel-agenda-semana");

    await page.goto(`/dashboard/services?businessId=${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, "08-painel-servicos");

    await page.goto(`/dashboard/customers?businessId=${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, "09-painel-clientes");

    await page.goto(`/dashboard/settings?businessId=${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, "10-painel-configuracoes");
  });
});
