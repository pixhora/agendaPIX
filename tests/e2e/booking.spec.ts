import { createHmac } from "node:crypto";
import { expect } from "@playwright/test";
import { Pool } from "pg";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow, readMeta } from "./helpers";

const meta = readMeta();

test.use({ storageState: { cookies: [], origins: [] } });

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
    const { rows } = await pool.query<{ external_id: string; amount_cents: number; copy_paste: string; qr_code_data_url: string }>(
      `select p.external_id, p.amount_cents, p.copy_paste, p.qr_code_data_url
       from payments p join businesses b on b.id = p.business_id
       where b.slug = $1 order by p.created_at desc limit 1`,
      [slug],
    );
    return rows[0];
  });
}

async function expireLatestHold(slug: string) {
  return withPool(async (pool) => {
    // Check bookings_pending_expiry_required: expires_at > created_at, mas pode ser < now().
    await pool.query(
      `update bookings bk
       set expires_at = bk.created_at + interval '1 second'
       from businesses b
       where b.id = bk.business_id and b.slug = $1 and bk.status = 'pending_payment'`,
      [slug],
    );
    await pool.query(
      `update payments p
       set expires_at = p.created_at + interval '1 second'
       from businesses b
       where b.id = p.business_id and b.slug = $1 and p.status in ('pending', 'creating')`,
      [slug],
    );
  });
}

async function fillBookingUntilPix(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo) {
  await page.goto(`/${meta.businessASlug}`);
  await expect(page.getByRole("heading", { level: 1, name: "Negócio E2E A" })).toBeVisible();

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

  await page.locator("#customer-name").fill(`Cliente Pix ${testInfo.project.name}`);
  await page.locator("#customer-phone").fill("11987654321");
  await page.locator("#customer-cpf").fill("52998224725");
  await page.getByRole("button", { name: /Gerar Pix de R\$\s?10,00/ }).filter({ visible: true }).first().click();

  await expect(page.getByRole("button", { name: /Copiar código Pix/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ambiente de teste")).toBeVisible();
}

test("cliente agenda pela página pública, paga o sinal Pix (fake) e vê a reserva confirmada", async ({ page, request, context }, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

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

  // 3. Nome, WhatsApp e CPF antes do Pix
  await page.locator("#customer-name").fill(`Cliente Pix ${testInfo.project.name}`);
  await page.locator("#customer-phone").fill("11987654321");
  await page.locator("#customer-cpf").fill("52998224725");
  await expectNoAxeViolations(page, "página pública: dados");
  await page.getByRole("button", { name: /Gerar Pix de R\$\s?10,00/ }).filter({ visible: true }).first().click();

  // 4. Pix gerado no contrato unificado (qrCodeDataUrl PNG + copyPaste EMV fake)
  await expect(page.getByRole("button", { name: /Copiar código Pix/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ambiente de teste")).toBeVisible();
  const qr = page.getByRole("img", { name: /QR Code do Pix/ });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
  const copyPaste = page.getByTestId("pix-copypaste");
  await expect(copyPaste).toHaveValue(/FAKE-PIX-NOT-PAYABLE:/);
  await expectNoAxeViolations(page, "página pública: Pix");

  // 4b. Sem webhook, "Já paguei" não gira para sempre: mostra aviso e libera o botão.
  const checkButton = page.getByRole("button", { name: /Já paguei, verificar agora/ });
  await checkButton.click();
  await expect(page.getByRole("alert").filter({ hasText: /Ainda não recebemos a confirmação do Pix/ })).toBeVisible({ timeout: 10_000 });
  await expect(checkButton).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Simular pagamento \(dev\)/ })).toBeVisible();

  // Copia-e-cola: botão escreve o EMV no clipboard
  await page.getByTestId("pix-copy-button").click();
  await expect(page.getByRole("button", { name: /Código copiado/ })).toBeVisible();
  const clipped = await page.evaluate(async () => navigator.clipboard.readText());
  expect(clipped).toMatch(/^FAKE-PIX-NOT-PAYABLE:/);
  expect(clipped).toBe(await copyPaste.inputValue());

  // Webhook assinado do provedor fake confirma o pagamento.
  const payment = await latestPayment(meta.businessASlug);
  expect(payment?.external_id).toBeTruthy();
  expect(payment?.qr_code_data_url).toMatch(/^data:image\/png;base64,/);
  expect(payment?.copy_paste).toMatch(/^FAKE-PIX-NOT-PAYABLE:/);
  const body = JSON.stringify({ eventId: `evt-e2e-${Date.now()}-${testInfo.project.name}`, type: "payment.paid", externalId: payment.external_id, amountCents: payment.amount_cents, paidAt: new Date().toISOString() });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", process.env.FAKE_WEBHOOK_SECRET ?? "").update(`${timestamp}.${body}`).digest("hex");
  const webhook = await request.post("/api/webhooks/payments/fake", { headers: { "content-type": "application/json", "x-fake-timestamp": timestamp, "x-fake-signature": signature }, data: body });
  expect(webhook.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Corte E2E").first()).toBeVisible();
  await expectNoAxeViolations(page, "página pública: confirmado");
});

test("Pix pendente expira e a tela anuncia reserva esgotada", async ({ page }, testInfo) => {
  await fillBookingUntilPix(page, testInfo);
  await expect(page.getByRole("img", { name: /QR Code do Pix/ })).toHaveAttribute("src", /^data:image\/png;base64,/);

  await expireLatestHold(meta.businessASlug);
  await page.getByRole("button", { name: /Já paguei, verificar agora/ }).click();

  await expect(page.getByRole("heading", { name: "Tempo de reserva esgotado" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Fazer novo agendamento/ })).toBeVisible();
});
