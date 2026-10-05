import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { createBooking, getAvailability, getBookingPayment, hash } from "../../lib/bookings/service";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider, signFakeWebhook } from "../../lib/payments/fake";
import { processWebhook } from "../../lib/payments/webhook";
import { simulateDevFakePayment } from "../../lib/payments/simulate-dev";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const secret = "test-only-webhook-secret-with-32-characters";
const provider = new FakePaymentProvider(secret);
let ownerId: string;
let businessIds: string[];
let slugs: string[];
let serviceIds: string[];
let bodyHashes: string[];
const input = () => ({ serviceId: serviceIds[0], startsAt: "2030-01-01T12:00:00Z", customer: { name: "Cliente de teste", phone: "+5511999999999" , cpfCnpj: "52998224725" } });

function webhook(externalId: string, overrides: Record<string, unknown> = {}, signed = true) {
  const body = JSON.stringify({ eventId: randomUUID(), type: "payment.paid", externalId, amountCents: 1000, paidAt: new Date().toISOString(), ...overrides });
  bodyHashes.push(hash(body));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({ "content-type": "application/json" });
  if (signed) {
    headers.set("x-fake-timestamp", timestamp);
    headers.set("x-fake-signature", signFakeWebhook(body, timestamp, secret));
  }
  return new Request("http://localhost/api/webhooks/payments/fake", { method: "POST", headers, body });
}

beforeEach(async () => {
  ownerId = randomUUID(); businessIds = [randomUUID(), randomUUID()]; serviceIds = [randomUUID(), randomUUID()];
  slugs = businessIds.map((id) => `pix-${id}`); bodyHashes = [];
  await database.insert(schema.user).values({ id: ownerId, name: "Dono de teste", email: `${ownerId}@example.com` });
  for (let index = 0; index < 2; index++) {
    await database.insert(schema.businesses).values({ id: businessIds[index], ownerId, name: "Negócio de teste", slug: slugs[index] });
    await database.insert(schema.services).values({ id: serviceIds[index], businessId: businessIds[index], name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
    await database.insert(schema.businessHours).values({ businessId: businessIds[index], weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
  }
});

afterEach(async () => {
  await database.delete(schema.paymentAudit).where(inArray(schema.paymentAudit.businessId, businessIds));
  const payments = await database.select().from(schema.payments).where(inArray(schema.payments.businessId, businessIds));
  const externalIds = payments.flatMap((payment) => payment.externalId ? [payment.externalId] : []);
  if (externalIds.length) await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
  if (bodyHashes.length) await database.delete(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.bodyHash, bodyHashes));
  await database.delete(schema.payments).where(inArray(schema.payments.businessId, businessIds));
  await database.delete(schema.bookings).where(inArray(schema.bookings.businessId, businessIds));
  await database.delete(schema.customers).where(inArray(schema.customers.businessId, businessIds));
  await database.delete(schema.businessHours).where(inArray(schema.businessHours.businessId, businessIds));
  await database.delete(schema.services).where(inArray(schema.services.businessId, businessIds));
  await database.delete(schema.businesses).where(inArray(schema.businesses.id, businessIds));
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
});
afterAll(async () => { await pool.end(); });
async function webhookRowCounts() {
  const [deliveries] = await database.select({ count: sql<number>`count(*)::int` }).from(schema.webhookDeliveries);
  const [events] = await database.select({ count: sql<number>`count(*)::int` }).from(schema.paymentEvents);
  return { deliveries: deliveries.count, events: events.count };
}

describe("reserva e cobrança do sinal", () => {
  it("gera cobrança, protege consulta e repete pedido sem duplicar", async () => {
    const key = randomUUID();
    const first = await createBooking(slugs[0], input(), key, database, provider);
    expect(first.data.status).toBe("pending_payment");
    expect(first.data.payment?.amountCents).toBe(1000);
    expect(first.data.payment?.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
    expect(first.data.payment?.qrCodeDataUrl).toMatch(/^data:image/);
    const second = await createBooking(slugs[0], input(), key, database, provider);
    expect(second.replayed).toBe(true);
    expect(second.data).toEqual(first.data);
    const status = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(status.payment?.id).toBe(first.data.payment?.id);
    await expect(getBookingPayment(slugs[0], first.data.bookingId, null, database)).rejects.toMatchObject({ status: 404 });
    await expect(getBookingPayment(slugs[1], first.data.bookingId, `Bearer ${first.data.accessToken}`, database)).rejects.toMatchObject({ status: 404 });
    await expect(createBooking(slugs[0], { ...input(), customer: { ...input().customer, name: "Outro nome" } }, key, database, provider)).rejects.toMatchObject({ status: 409 });
  });
  it("duas requisições concorrentes não ocupam o mesmo horário", async () => {
    const result = await Promise.allSettled([createBooking(slugs[0], input(), randomUUID(), database, provider), createBooking(slugs[0], input(), randomUUID(), database, provider)]);
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((item) => item.status === "rejected")).toHaveLength(1);
    const bookings = await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, businessIds[0]));
    expect(bookings).toHaveLength(1);
    const available = await getAvailability(slugs[0], { serviceId: serviceIds[0], date: "2030-01-01" }, database);
    expect(available.slots.some((slot) => slot.startsAt.toISOString() === "2030-01-01T12:00:00.000Z")).toBe(false);
  });
  it("restrição do Postgres impede sobreposição mesmo sem passar pela aplicação", async () => {
    const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const [original] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    await expect(database.insert(schema.bookings).values({ businessId: businessIds[0], serviceId: serviceIds[0], customerId: original.customerId,
      startsAt: new Date("2030-01-01T12:15:00Z"), endsAt: new Date("2030-01-01T12:45:00Z"), priceCents: 5000, depositCents: 1000, status: "confirmed" })).rejects.toMatchObject({ cause: { code: "23P01" } });
  });
  it("sinal zero confirma sem exigir provider ou criar cobrança", async () => {
    await database.update(schema.services).set({ depositCents: 0 }).where(eq(schema.services.id, serviceIds[0]));
    const result = await createBooking(slugs[0], input(), randomUUID(), database);
    expect(result.data.status).toBe("confirmed"); expect(result.data.payment).toBeNull();
  });
  it("falha do provider reverte reserva e permite nova tentativa", async () => {
    const key = randomUUID();
    const broken = { name: provider.name, createPixCharge: async () => { throw new Error("Falha simulada"); }, getCharge: provider.getCharge.bind(provider), findChargeByReference: provider.findChargeByReference.bind(provider), cancelCharge: provider.cancelCharge.bind(provider), verifyWebhook: provider.verifyWebhook.bind(provider) };
    await expect(createBooking(slugs[0], input(), key, database, broken)).rejects.toMatchObject({ status: 503 });
    const stuck = await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, businessIds[0]));
    expect(stuck).toHaveLength(1);
    expect(stuck[0].status).toBe("pending_payment");
    const [stuckPayment] = await database.select().from(schema.payments).where(eq(schema.payments.bookingId, stuck[0].id));
    expect(stuckPayment.status).toBe("creating");
    // Replay com a mesma chave retoma a cobrança fora da transação, sem segunda reserva.
    const resumed = await createBooking(slugs[0], input(), key, database, provider);
    expect(resumed.replayed).toBe(true);
    expect(resumed.data.payment?.amountCents).toBe(1000);
    expect(resumed.data.payment?.status).toBe("pending");
    expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, businessIds[0]))).toHaveLength(1);
  });
  it("mesma chave em negócios diferentes não cruza cobranças", async () => {
    const key = randomUUID();
    const first = await createBooking(slugs[0], input(), key, database, provider);
    const second = await createBooking(slugs[1], { ...input(), serviceId: serviceIds[1] }, key, database, provider);
    expect(first.data.payment?.externalId).not.toBe(second.data.payment?.externalId);
    await expect(createBooking(slugs[1], input(), randomUUID(), database, provider)).rejects.toMatchObject({ status: 404 });
  });
});

describe("webhook transacional e auditável", () => {
  it("falha depois da confirmação reverte efeitos e permite repetir o mesmo evento", async () => {
    const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const request = webhook(data.payment!.externalId!);
    const failingDatabase = new Proxy(database, {
      get(target, property, receiver) {
        if (property === "transaction") return (callback: Parameters<typeof database.transaction>[0]) => target.transaction(async (transaction) => {
          await callback(transaction);
          throw new Error("Falha simulada antes do commit");
        });
        return Reflect.get(target, property, receiver);
      },
    });
    await expect(processWebhook(request.clone(), "fake", failingDatabase, provider)).rejects.toMatchObject({ status: 503 });
    expect((await getBookingPayment(slugs[0], data.bookingId, `Bearer ${data.accessToken}`, database)).status).toBe("pending_payment");
    // Falha reverte também a entrega: nada fica gravado e o reenvio do provedor processa normalmente.
    expect(await database.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.bodyHash, bodyHashes[0]))).toHaveLength(0);
    expect(await processWebhook(request.clone(), "fake", database, provider)).toMatchObject({ outcome: "processed" });
    const deliveries = await database.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.bodyHash, bodyHashes[0]));
    expect(deliveries.map((delivery) => delivery.outcome)).toEqual(["processed"]);
  });
  it("processa entregas simultâneas uma vez e grava uma única entrega", async () => {
    const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const eventId = randomUUID();
    const request = webhook(data.payment!.externalId!, { eventId });
    const result = await Promise.all([processWebhook(request.clone(), "fake", database, provider), processWebhook(request.clone(), "fake", database, provider)]);
    expect(result.map((item) => item.outcome).sort()).toEqual(["duplicate", "processed"]);
    expect(await database.select().from(schema.paymentEvents).where(eq(schema.paymentEvents.eventId, eventId))).toHaveLength(1);
    expect(await database.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.eventId, eventId))).toHaveLength(1);
    const status = await getBookingPayment(slugs[0], data.bookingId, `Bearer ${data.accessToken}`, database);
    expect(status.status).toBe("confirmed"); expect(status.payment?.status).toBe("paid"); expect(status.payment?.copyPaste).toBeNull();
  });
  it("assinatura inválida ou evento malformado não gravam nada nem alteram pagamento", async () => {
    const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const before = await webhookRowCounts();
    for (let attempt = 0; attempt < 25; attempt++) {
      await expect(processWebhook(webhook(data.payment!.externalId!, {}, false), "fake", database, provider)).rejects.toMatchObject({ status: 401 });
    }
    await expect(processWebhook(webhook(data.payment!.externalId!, { amountCents: "1000" }), "fake", database, provider)).rejects.toMatchObject({ status: 400 });
    await expect(processWebhook(webhook(data.payment!.externalId!), "other", database, provider)).rejects.toMatchObject({ status: 404 });
    expect(await webhookRowCounts()).toEqual(before);
    expect((await getBookingPayment(slugs[0], data.bookingId, `Bearer ${data.accessToken}`, database)).payment?.status).toBe("pending");
  });
  it("replay sequencial do mesmo evento é no-op: uma entrega, um evento, resposta duplicate", async () => {
    const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const eventId = randomUUID();
    const request = webhook(data.payment!.externalId!, { eventId });
    expect(await processWebhook(request.clone(), "fake", database, provider)).toMatchObject({ outcome: "processed" });
    const before = await webhookRowCounts();
    for (let attempt = 0; attempt < 3; attempt++) expect(await processWebhook(request.clone(), "fake", database, provider)).toMatchObject({ outcome: "duplicate" });
    expect(await webhookRowCounts()).toEqual(before);
    const [delivery] = await database.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.eventId, eventId));
    expect(delivery.outcome).toBe("processed");
  });
  it("valor incorreto não confirma, e evento posterior correto confirma", async () => {
    const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    expect(await processWebhook(webhook(data.payment!.externalId!, { amountCents: 999 }), "fake", database, provider)).toMatchObject({ outcome: "rejected", reason: "amount_mismatch" });
    expect((await getBookingPayment(slugs[0], data.bookingId, `Bearer ${data.accessToken}`, database)).status).toBe("pending_payment");
    expect(await processWebhook(webhook(data.payment!.externalId!), "fake", database, provider)).toMatchObject({ outcome: "processed" });
  });
  it("não aceita outro conteúdo para identificador já processado", async () => {
    const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const eventId = randomUUID();
    await processWebhook(webhook(data.payment!.externalId!, { eventId }), "fake", database, provider);
    const before = await webhookRowCounts();
    await expect(processWebhook(webhook(data.payment!.externalId!, { eventId, amountCents: 2000 }), "fake", database, provider)).rejects.toMatchObject({ status: 409 });
    expect(await webhookRowCounts()).toEqual(before);
  });
  it("pagamento tardio não toma horário reservado novamente", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.payments.id, first.data.payment!.id));
    const second = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    expect(await processWebhook(webhook(first.data.payment!.externalId!), "fake", database, provider)).toMatchObject({ outcome: "ignored", reason: "late_payment_refund_pending" });
    const old = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(old.status).toBe("expired"); expect(old.payment?.status).toBe("refund_pending");
    expect((await getBookingPayment(slugs[0], second.data.bookingId, `Bearer ${second.data.accessToken}`, database)).status).toBe("pending_payment");
  });
  it("evento de um negócio não altera a reserva do outro", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const second = await createBooking(slugs[1], { ...input(), serviceId: serviceIds[1] }, randomUUID(), database, provider);
    await processWebhook(webhook(first.data.payment!.externalId!), "fake", database, provider);
    const [booking] = await database.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, businessIds[1]), eq(schema.bookings.id, second.data.bookingId)));
    expect(booking.status).toBe("pending_payment");
  });
});

describe("simulação de Pix fake em desenvolvimento", () => {
  it("confirma pagamento pendente pelo mesmo caminho do webhook", async () => {
    const previousProvider = process.env.PAYMENT_PROVIDER;
    const previousSecret = process.env.FAKE_WEBHOOK_SECRET;
    process.env.PAYMENT_PROVIDER = "fake";
    process.env.FAKE_WEBHOOK_SECRET = secret;
    try {
      const { data } = await createBooking(slugs[0], input(), randomUUID(), database, provider);
      const result = await simulateDevFakePayment({
        slug: slugs[0],
        bookingId: data.bookingId,
        authorization: `Bearer ${data.accessToken}`,
        database,
      });
      expect(result.outcome).toBe("processed");
      const status = await getBookingPayment(slugs[0], data.bookingId, `Bearer ${data.accessToken}`, database);
      expect(status.status).toBe("confirmed");
      expect(status.payment?.status).toBe("paid");
    } finally {
      if (previousProvider === undefined) delete process.env.PAYMENT_PROVIDER;
      else process.env.PAYMENT_PROVIDER = previousProvider;
      if (previousSecret === undefined) delete process.env.FAKE_WEBHOOK_SECRET;
      else process.env.FAKE_WEBHOOK_SECRET = previousSecret;
    }
  });
});
