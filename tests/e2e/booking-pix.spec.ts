import { createHash, createHmac, randomUUID } from "node:crypto";
import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema";

type Business = { slug: string; serviceId: string; database: ReturnType<typeof drizzle<typeof schema>>; businessId: string; bodyHashes: string[] };

const test = base.extend<{ business: Business }>({
  business: async ({}, runFixture) => {
    if (!process.env.DATABASE_URL || !process.env.FAKE_WEBHOOK_SECRET) {
      throw new Error("Configure DATABASE_URL e FAKE_WEBHOOK_SECRET em .env para executar os testes e2e.");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    const database = drizzle(pool, { schema });
    const ownerId = randomUUID();
    const businessId = randomUUID();
    const serviceId = randomUUID();
    const slug = `e2e-${businessId}`;
    const bodyHashes: string[] = [];
    try {
      await database.insert(schema.user).values({ id: ownerId, name: "Dono E2E", email: `${ownerId}@example.com` });
      await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Salão E2E", slug });
      await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
      await database.insert(schema.businessHours).values(Array.from({ length: 7 }, (_, weekday) => ({ businessId, weekday, opensAt: "09:00:00", closesAt: "18:00:00" })));
      await runFixture({ slug, serviceId, database, businessId, bodyHashes });
    } finally {
      try {
        const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
        const externalIds = payments.flatMap((payment) => payment.externalId ? [payment.externalId] : []);
        if (externalIds.length) await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
        if (bodyHashes.length) await database.delete(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.bodyHash, bodyHashes));
        await database.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
        await database.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
        await database.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
        await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, businessId));
        await database.delete(schema.services).where(eq(schema.services.businessId, businessId));
        await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
        await database.delete(schema.user).where(eq(schema.user.id, ownerId));
      } finally {
        await pool.end();
      }
    }
  },
});


async function reserve(request: APIRequestContext, business: Business) {
  const services = await request.get(`/api/public/${business.slug}/services`);
  expect(services.status()).toBe(200);
  const publicBusiness = await services.json();
  expect(publicBusiness.services).toEqual([expect.objectContaining({ id: business.serviceId, depositCents: 1000 })]);
  expect(JSON.stringify(publicBusiness)).not.toContain(process.env.FAKE_WEBHOOK_SECRET);
  expect(JSON.stringify(publicBusiness)).not.toMatch(/"(?:pixKey|pix_key|privateKey|private_key|webhookSecret|webhook_secret|apiKey|api_key)"\s*:/i);
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const availability = await request.get(`/api/public/${business.slug}/availability`, { params: { serviceId: business.serviceId, date } });
  expect(availability.status()).toBe(200);
  const { slots } = await availability.json();
  expect(slots.length).toBeGreaterThan(0);
  const input = { serviceId: business.serviceId, startsAt: slots[0].startsAt, customer: { name: "Cliente E2E", phone: "+5511999999999" } };
  const response = await request.post(`/api/public/${business.slug}/bookings`, { headers: { "Idempotency-Key": randomUUID() }, data: input });
  expect(response.status()).toBe(201);
  const booking = await response.json();
  expect(booking).toMatchObject({ status: "pending_payment", startsAt: input.startsAt, payment: { provider: "fake", status: "pending", amountCents: 1000 } });
  expect(JSON.stringify(booking)).not.toContain(process.env.FAKE_WEBHOOK_SECRET);
  expect(JSON.stringify(booking)).not.toMatch(/"(?:pixKey|pix_key|privateKey|private_key|webhookSecret|webhook_secret|apiKey|api_key)"\s*:/i);
  expect(booking.payment.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
  expect(booking.payment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  return { booking, input, date };
}

async function paymentStatus(request: APIRequestContext, slug: string, booking: { bookingId: string; accessToken: string }) {
  const response = await request.get(`/api/public/${slug}/bookings/${booking.bookingId}/payment`, { headers: { Authorization: `Bearer ${booking.accessToken}` } });
  expect(response.status()).toBe(200);
  return response.json();
}

function paidWebhook(externalId: string, business: Business, amountCents = 1000) {
  const body = JSON.stringify({ eventId: randomUUID(), type: "payment.paid", externalId, amountCents, paidAt: new Date().toISOString() });
  const timestamp = String(Math.floor(Date.now() / 1000));
  business.bodyHashes.push(createHash("sha256").update(body).digest("hex"));
  return { data: body, headers: { "Content-Type": "application/json", "X-Fake-Timestamp": timestamp,
    "X-Fake-Signature": createHmac("sha256", process.env.FAKE_WEBHOOK_SECRET!).update(`${timestamp}.${body}`).digest("hex") } };
}

test("agenda, paga sinal fake e confirma pelo HTTP", async ({ request, business }) => {
  const { booking } = await reserve(request, business);
  expect((await paymentStatus(request, business.slug, booking)).status).toBe("pending_payment");
  const response = await request.post("/api/webhooks/payments/fake", paidWebhook(booking.payment.externalId, business));
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ outcome: "processed" });
  expect(await paymentStatus(request, business.slug, booking)).toMatchObject({ status: "confirmed", payment: { status: "paid", amountCents: 1000, copyPaste: null, qrCodeDataUrl: null } });
});

test("interface pública agenda e confirma com API, banco e webhook reais", async ({ page, request, business }) => {
  test.skip(!process.env.QA_BOOKING_UI_URL, "Defina QA_BOOKING_UI_URL para a interface do Terminal 4.");
  // Ponte de QA entre branches: respostas vêm do backend real em 3103, sem dados mockados.
  await page.route("**/api/public/**", async (route) => {
    const source = route.request();
    const url = new URL(source.url());
    const sourceHeaders = source.headers();
    const headers = Object.fromEntries(["content-type", "idempotency-key", "authorization"].flatMap((name) => sourceHeaders[name] ? [[name, sourceHeaders[name]]] : []));
    const response = await request.fetch(`${url.pathname}${url.search}`, {
      method: source.method(), headers, data: source.postData() ?? undefined,
    });
    await route.fulfill({ response });
  });
  await page.goto(`${process.env.QA_BOOKING_UI_URL}/${business.slug}`);
  await page.getByRole("radio", { name: /Corte/ }).click();
  await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  await page.getByRole("button", { name: /^Amanhã/ }).click();
  await page.getByRole("radiogroup", { name: "Horários disponíveis", exact: true }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Preencher meus dados" }).click();
  await page.getByLabel("Nome completo").fill("Cliente UI E2E");
  await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
  const [charge] = await business.database.select().from(schema.payments).where(eq(schema.payments.businessId, business.businessId));
  expect(charge.amountCents).toBe(1000);
  await page.waitForTimeout(4500);
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).not.toBeVisible();
  const [pendingBooking] = await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId));
  expect(pendingBooking.status).toBe("pending_payment");
  const delivery = await request.post("/api/webhooks/payments/fake", paidWebhook(charge.externalId!, business));
  expect(delivery.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 8000 });
  const [booking] = await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId));
  expect(booking.status).toBe("confirmed");
});

test("consulta pública rejeita token, ID e slug manipulados sem expor dados", async ({ request, business }) => {
  const { booking } = await reserve(request, business);
  const valid = await request.get(`/api/public/${business.slug}/bookings/${booking.bookingId}/payment`, {
    headers: { Authorization: `Bearer ${booking.accessToken}` },
  });
  const publicStatus = await valid.json();
  expect(JSON.stringify(publicStatus)).not.toContain(process.env.FAKE_WEBHOOK_SECRET);
  expect(JSON.stringify(publicStatus)).not.toMatch(/"(?:pixKey|pix_key|privateKey|private_key|webhookSecret|webhook_secret|apiKey|api_key|customerName|customerPhone|ownerId|owner_id)"\s*:/i);
  expect(publicStatus).not.toHaveProperty("accessToken");
  for (const [slug, id, token] of [
    [business.slug, booking.bookingId, null],
    [business.slug, booking.bookingId, "invalid-token"],
    [business.slug, randomUUID(), booking.accessToken],
    [`other-${randomUUID()}`, booking.bookingId, booking.accessToken],
  ]) {
    const response = await request.get(`/api/public/${slug}/bookings/${id}/payment`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: { code: slug === business.slug ? "booking_not_found" : "business_not_found", message: expect.any(String) } });
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
});

test("payload e webhook inválidos não alteram reserva ou valor do sinal", async ({ request, business }) => {
  const { booking, input } = await reserve(request, business);
  for (const data of [{ ...input, depositCents: 1 }, { ...input, serviceId: "invalid" }, { ...input, customer: { name: "", phone: "11999999999" } }]) {
    const response = await request.post(`/api/public/${business.slug}/bookings`, { headers: { "Idempotency-Key": randomUUID() }, data });
    expect(response.status()).toBe(400);
  }
  const invalidSignature = paidWebhook(booking.payment.externalId, business);
  invalidSignature.headers["X-Fake-Signature"] = "0".repeat(64);
  expect((await request.post("/api/webhooks/payments/fake", invalidSignature)).status()).toBe(401);
  const wrongAmount = await request.post("/api/webhooks/payments/fake", paidWebhook(booking.payment.externalId, business, 999));
  expect(wrongAmount.status()).toBe(200);
  expect(await wrongAmount.json()).toMatchObject({ outcome: "rejected", reason: "amount_mismatch" });
  expect(await paymentStatus(request, business.slug, booking)).toMatchObject({ status: "pending_payment", payment: { status: "pending", amountCents: 1000 } });
  expect(await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId))).toHaveLength(1);
});

test("horário ocupado retorna 409 sem criar segunda reserva ou cobrança", async ({ request, business }) => {
  const { booking, input, date } = await reserve(request, business);
  const response = await request.post(`/api/public/${business.slug}/bookings`, { headers: { "Idempotency-Key": randomUUID() }, data: { ...input, customer: { name: "Outro cliente", phone: "+5511888888888" } } });
  expect(response.status()).toBe(409);
  const availability = await request.get(`/api/public/${business.slug}/availability`, { params: { serviceId: business.serviceId, date } });
  expect(availability.status()).toBe(200);
  expect((await availability.json()).slots.some((slot: { startsAt: string }) => slot.startsAt === input.startsAt)).toBe(false);
  expect((await paymentStatus(request, business.slug, booking)).status).toBe("pending_payment");
  expect(await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId))).toHaveLength(1);
  expect(await business.database.select().from(schema.payments).where(eq(schema.payments.businessId, business.businessId))).toHaveLength(1);
});

test("webhook repetido e novo evento do mesmo pagamento não duplicam efeitos", async ({ request, business }) => {
  const { booking } = await reserve(request, business);
  const delivery = paidWebhook(booking.payment.externalId, business);
  const first = await request.post("/api/webhooks/payments/fake", delivery);
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ outcome: "processed" });
  const before = await business.database.select().from(schema.payments).where(eq(schema.payments.id, booking.payment.id));
  for (const repeated of [delivery, paidWebhook(booking.payment.externalId, business)]) {
    const response = await request.post("/api/webhooks/payments/fake", repeated);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "duplicate" });
  }
  expect(await paymentStatus(request, business.slug, booking)).toMatchObject({ status: "confirmed", payment: { status: "paid" } });
  expect(await business.database.select().from(schema.payments).where(eq(schema.payments.id, booking.payment.id))).toEqual(before);
  expect(await business.database.select().from(schema.payments).where(eq(schema.payments.businessId, business.businessId))).toHaveLength(1);
  const events = await business.database.select().from(schema.paymentEvents).where(eq(schema.paymentEvents.externalId, booking.payment.externalId));
  expect(events).toHaveLength(2);
  const deliveries = await business.database.select().from(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.bodyHash, business.bodyHashes));
  expect(deliveries.map((entry) => entry.outcome).sort()).toEqual(["duplicate", "duplicate", "processed"]);
  expect(await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId))).toHaveLength(1);
});
