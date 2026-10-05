import { createHmac } from "node:crypto";
import { expect } from "@playwright/test";
import { Pool } from "pg";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow, readMeta } from "./helpers";

const meta = readMeta();

test.use({ storageState: { cookies: [], origins: [] } });

async function latestPayment(slug: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<{ external_id: string; amount_cents: number }>(
      `select p.external_id, p.amount_cents from payments p join businesses b on b.id = p.business_id
       where b.slug = $1 order by p.created_at desc limit 1`,
      [slug],
    );
    return rows[0];
  } finally {
    await pool.end();
  }
}

test("cliente agenda pela página pública, paga o sinal Pix (fake) e vê a reserva confirmada", async ({ page, request }, testInfo) => {
  await page.goto(`/${meta.businessASlug}`);
  await expect(page.getByRole("heading", { level: 1, name: "Negócio E2E A" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, "página pública: serviços");

  // 1. Serviço
  await page.getByRole("radiogroup", { name: /Serviços/ }).getByRole("radio", { name: /Corte E2E/ }).click();
  await page.getByRole("button", { name: /Escolher horário/ }).filter({ visible: true }).first().click();

  // 2. Dia e horário (primeiro dia com vaga)
  const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
  const days = page.getByTestId("day-option");
  await expect(days.first()).toBeVisible();
  const dayCount = await days.count();
  for (let index = 0; index < dayCount; index += 1) {
    // waitFor espera a busca de horários do dia terminar (isVisible não espera).
    if (await slots.first().waitFor({ state: "visible", timeout: 6_000 }).then(() => true, () => false)) break;
    await days.nth(index + 1).click();
  }
  await slots.first().click();
  await expectNoAxeViolations(page, "página pública: horários");
  await page.getByRole("button", { name: /Continuar com \d{2}:\d{2}/ }).filter({ visible: true }).first().click();

  // 3. Só nome e WhatsApp antes do Pix
  await page.locator("#customer-name").fill(`Cliente Pix ${testInfo.project.name}`);
  await page.locator("#customer-phone").fill("11987654321");
  await expectNoAxeViolations(page, "página pública: dados");
  await page.getByRole("button", { name: /Gerar Pix de R\$\s?10,00/ }).filter({ visible: true }).first().click();

  // 4. Pix gerado
  await expect(page.getByRole("button", { name: /Copiar código Pix/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ambiente de teste")).toBeVisible();
  await expectNoAxeViolations(page, "página pública: Pix");

  // Webhook assinado do provedor fake confirma o pagamento.
  const payment = await latestPayment(meta.businessASlug);
  expect(payment?.external_id).toBeTruthy();
  const body = JSON.stringify({ eventId: `evt-e2e-${Date.now()}-${testInfo.project.name}`, type: "payment.paid", externalId: payment.external_id, amountCents: payment.amount_cents, paidAt: new Date().toISOString() });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", process.env.FAKE_WEBHOOK_SECRET ?? "").update(`${timestamp}.${body}`).digest("hex");
  const webhook = await request.post("/api/webhooks/payments/fake", { headers: { "content-type": "application/json", "x-fake-timestamp": timestamp, "x-fake-signature": signature }, data: body });
  expect(webhook.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Corte E2E").first()).toBeVisible();
  await expectNoAxeViolations(page, "página pública: confirmado");
});
