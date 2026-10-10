import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { bookingRequestDigest, createBooking, getAvailability, getBookingPayment, hash, legacyBookingRequestDigest, listPublicServices } from "../../lib/bookings/service";
import { bookingInputSchema } from "../../lib/bookings/validation";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider, signFakeWebhook } from "../../lib/payments/fake";
import { PIX_APPROVAL_TOLERANCE_MS } from "../../lib/payments/rules";
import { processWebhook } from "../../lib/payments/webhook";
import { reconcileOnce } from "../../lib/payments/reconcile";
import { simulateDevFakePayment } from "../../lib/payments/simulate-dev";
import { padraoPolicyHash } from "../helpers/deposit-policy";
import { disconnectMercadoPago } from "../../lib/mercadopago-oauth/credentials";
import { createDrizzleMpStore } from "../../lib/mercadopago-oauth/repository";
import { MP_DISCONNECT_SETTLEMENT_GRACE_MS, purgeDisconnectedMercadoPagoTokens } from "../../lib/mercadopago-oauth/refresh";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const secret = "test-only-webhook-secret-with-32-characters";
const provider = new FakePaymentProvider(secret);
let ownerId: string;
let businessIds: string[];
let slugs: string[];
let serviceIds: string[];
let bodyHashes: string[];
const input = () => ({ serviceId: serviceIds[0], startsAt: "2030-01-01T12:00:00Z", customer: { name: "Cliente de teste", phone: "+5511999999999" , cpfCnpj: "52998224725" }, policyHash: padraoPolicyHash("Negócio de teste") });

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
    await insertConnectedMercadoPago(database, businessIds[index]);
  }
});

afterEach(async () => {
  await database.delete(schema.paymentAudit).where(inArray(schema.paymentAudit.businessId, businessIds));
  const payments = await database.select().from(schema.payments).where(inArray(schema.payments.businessId, businessIds));
  const externalIds = payments.flatMap((payment) => payment.externalId ? [payment.externalId] : []);
  if (externalIds.length) await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
  if (bodyHashes.length) await database.delete(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.bodyHash, bodyHashes));
  await database.delete(schema.paymentRefunds).where(inArray(schema.paymentRefunds.businessId, businessIds));
  await database.delete(schema.ownerNotices).where(inArray(schema.ownerNotices.businessId, businessIds));
  await database.delete(schema.payments).where(inArray(schema.payments.businessId, businessIds));
  await database.delete(schema.bookings).where(inArray(schema.bookings.businessId, businessIds));
  await database.delete(schema.customers).where(inArray(schema.customers.businessId, businessIds));
  await database.delete(schema.businessHours).where(inArray(schema.businessHours.businessId, businessIds));
  await database.delete(schema.services).where(inArray(schema.services.businessId, businessIds));
  await database.delete(schema.mercadopagoConnections).where(inArray(schema.mercadopagoConnections.businessId, businessIds));
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
  it("consentimento antigo bloqueia reserva nova e ainda confirma o Pix já gerado", async () => {
    const key = randomUUID();
    const first = await createBooking(slugs[0], input(), key, database, provider);
    await database.update(schema.mercadopagoConnections).set({ consentVersion: "2026-09-01.v1" }).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    const listed = await listPublicServices(slugs[0], database);
    expect(listed.services[0]).toMatchObject({ bookable: false, blockedReason: "mp_consent_outdated" });
    const replay = await createBooking(slugs[0], input(), key, database, provider);
    expect(replay.replayed).toBe(true);
    expect(replay.data.bookingId).toBe(first.data.bookingId);
    await expect(createBooking(slugs[0], { ...input(), startsAt: "2030-01-01T13:00:00Z" }, randomUUID(), database, provider)).rejects.toMatchObject({ status: 409, code: "mp_consent_outdated" });
    expect(await processWebhook(webhook(first.data.payment!.externalId!), "fake", database, provider)).toMatchObject({ outcome: "processed" });
    const status = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(status.status).toBe("confirmed");
    expect(status.payment?.status).toBe("paid");
  });
  it("não grava CPF e trata outro CPF na mesma chave como repetição", async () => {
    const key = randomUUID();
    const body = input();
    const created = await createBooking(slugs[0], body, key, database, provider);
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, created.data.bookingId));
    const parsed = bookingInputSchema.parse(body);
    expect(booking.requestHash).toBe(bookingRequestDigest(parsed));
    expect(booking.requestHash).not.toBe(legacyBookingRequestDigest(parsed));
    expect(JSON.stringify(booking)).not.toContain("52998224725");
    const [customer] = await database.select().from(schema.customers).where(eq(schema.customers.id, booking.customerId));
    expect(JSON.stringify(customer)).not.toContain("52998224725");
    const otherCpf = { ...body, customer: { ...body.customer, cpfCnpj: "39053344705" } };
    const replay = await createBooking(slugs[0], otherCpf, key, database, provider);
    expect(replay.replayed).toBe(true);
    expect(replay.data.bookingId).toBe(created.data.bookingId);
    const legacy = legacyBookingRequestDigest(parsed);
    await database.update(schema.bookings).set({ requestHash: legacy }).where(eq(schema.bookings.id, booking.id));
    const sameCpf = await createBooking(slugs[0], body, key, database, provider);
    expect(sameCpf.replayed).toBe(true);
    const [kept] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(kept.requestHash).toBe(legacy);
    await expect(createBooking(slugs[0], otherCpf, key, database, provider)).rejects.toMatchObject({ status: 409, code: "idempotency_conflict" });
    const [after] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(JSON.stringify(after)).not.toContain("39053344705");
    expect(JSON.stringify(after)).not.toContain("52998224725");
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
  it("vários dias numa consulta batem com uma consulta por dia", async () => {
    const dates = ["2030-01-01", "2030-01-02", "2030-01-03"];
    const combined = await getAvailability(slugs[0], { serviceId: serviceIds[0], date: dates[0], dates: dates.join(",") }, database);
    expect("days" in combined && combined.days?.map((day) => day.date)).toEqual(dates);
    for (const date of dates) {
      const single = await getAvailability(slugs[0], { serviceId: serviceIds[0], date }, database);
      const day = "days" in combined ? combined.days?.find((item) => item.date === date) : undefined;
      expect(day?.slots.map((slot) => slot.startsAt.toISOString())).toEqual(single.slots.map((slot) => slot.startsAt.toISOString()));
      expect("days" in single).toBe(false);
    }
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
  it("serviço sem sinal continua agendável com consentimento antigo", async () => {
    await database.update(schema.services).set({ depositCents: 0 }).where(eq(schema.services.id, serviceIds[0]));
    await database.update(schema.mercadopagoConnections).set({ consentVersion: "2026-09-01.v1", autoRefundAckAt: null }).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    const listed = await listPublicServices(slugs[0], database);
    expect(listed.services[0]).toMatchObject({ bookable: true, blockedReason: null });
    const result = await createBooking(slugs[0], input(), randomUUID(), database);
    expect(result.data.status).toBe("confirmed");
    expect(result.data.payment).toBeNull();
  });
  it("falha do provider reverte reserva e permite nova tentativa", async () => {
    const key = randomUUID();
    const broken = { name: provider.name, createPixCharge: async () => { throw new Error("Falha simulada"); }, getCharge: provider.getCharge.bind(provider), findChargeByReference: provider.findChargeByReference.bind(provider), cancelCharge: provider.cancelCharge.bind(provider), verifyWebhook: provider.verifyWebhook.bind(provider), refundCharge: provider.refundCharge.bind(provider) };
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
    const paidLate = new Date(Date.now() + PIX_APPROVAL_TOLERANCE_MS);
    provider.markPaid(first.data.payment!.externalId!, paidLate);
    let refundCalled = false;
    const hanging = {
      name: provider.name,
      createPixCharge: provider.createPixCharge.bind(provider),
      getCharge: provider.getCharge.bind(provider),
      findChargeByReference: provider.findChargeByReference.bind(provider),
      cancelCharge: provider.cancelCharge.bind(provider),
      verifyWebhook: provider.verifyWebhook.bind(provider),
      refundCharge: async () => {
        refundCalled = true;
        return { status: "refunded" as const, refundId: "nao" };
      },
    };
    expect(await processWebhook(webhook(first.data.payment!.externalId!, { paidAt: paidLate.toISOString(), paidAtSource: "date_approved" }), "fake", database, hanging)).toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    expect(refundCalled).toBe(true);
    const old = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(old.status).toBe("expired");
    expect(old.payment?.status).toBe("refunded");
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.paymentId, first.data.payment!.id));
    expect(audits.some((row) => row.action === "late_no_slot")).toBe(true);
    expect(audits.some((row) => row.action === "automatic_refund")).toBe(true);
    const report = await reconcileOnce(database, provider, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
    expect(report.refundsSettled).toBe(0);
    const refunded = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(refunded.payment?.status).toBe("refunded");
    const attempts = await database.select().from(schema.paymentRefunds).where(eq(schema.paymentRefunds.paymentId, first.data.payment!.id));
    expect(attempts).toHaveLength(1);
    expect((await getBookingPayment(slugs[0], second.data.bookingId, `Bearer ${second.data.accessToken}`, database)).status).toBe("pending_payment");
  });
  it("timeout do estorno no webhook responde 200 e o reconciliador estorna uma vez", async () => {
    vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "400");
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.payments.id, first.data.payment!.id));
    await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const paidLate = new Date(Date.now() + PIX_APPROVAL_TOLERANCE_MS);
    provider.markPaid(first.data.payment!.externalId!, paidLate);
    provider.latencyMs = 3_000;
    try {
      await expect(processWebhook(webhook(first.data.payment!.externalId!, { paidAt: paidLate.toISOString(), paidAtSource: "date_approved" }), "fake", database, provider)).resolves.toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
      const open = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
      expect(open.payment?.status).toBe("paid");
      const [attempt] = await database.select().from(schema.paymentRefunds).where(eq(schema.paymentRefunds.paymentId, first.data.payment!.id));
      expect(attempt?.status).toBe("requested");
      expect(attempt?.idempotencyKey).toBe(`auto_late:${first.data.payment!.id}`);
      provider.latencyMs = 0;
      vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "8000");
      const report = await reconcileOnce(database, provider, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
      expect(report.refundsSettled).toBe(1);
      const closed = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
      expect(closed.payment?.status).toBe("refunded");
      const attempts = await database.select().from(schema.paymentRefunds).where(eq(schema.paymentRefunds.paymentId, first.data.payment!.id));
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.status).toBe("refunded");
      expect(attempts[0]?.idempotencyKey).toBe(`auto_late:${first.data.payment!.id}`);
    } finally {
      provider.latencyMs = 0;
      vi.unstubAllEnvs();
    }
  });
  it("Pix aprovado no prazo e processado depois do hold confirma e não estorna", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const holdEnds = new Date(Date.now() - 30_000);
    const paidAt = new Date(holdEnds.getTime() - 60_000);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60_000), expiresAt: holdEnds }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: holdEnds }).where(eq(schema.payments.id, first.data.payment!.id));
    provider.markPaid(first.data.payment!.externalId!, paidAt);
    expect(await processWebhook(webhook(first.data.payment!.externalId!, { paidAt: paidAt.toISOString(), paidAtSource: "date_approved" }), "fake", database, provider)).toMatchObject({ outcome: "processed", reason: "on_time_reclaimed" });
    const booking = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(booking.status).toBe("confirmed");
    expect(booking.payment?.status).toBe("paid");
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.paymentId, first.data.payment!.id));
    expect(audits.some((row) => row.action === "late_no_slot")).toBe(false);
    expect(audits.some((row) => row.action === "automatic_refund")).toBe(false);
    const report = await reconcileOnce(database, provider, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
    expect(report.refundsSettled).toBe(0);
    expect((await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database)).payment?.status).toBe("paid");
  });
  it("Pix aprovado no prazo com horário já ocupado estorna sem perder o evento", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const holdEnds = new Date(Date.now() - 30_000);
    const paidAt = new Date(holdEnds.getTime() + PIX_APPROVAL_TOLERANCE_MS);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60_000), expiresAt: holdEnds }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: holdEnds }).where(eq(schema.payments.id, first.data.payment!.id));
    const second = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    provider.markPaid(first.data.payment!.externalId!, paidAt);
    await expect(processWebhook(webhook(first.data.payment!.externalId!, { paidAt: paidAt.toISOString(), paidAtSource: "date_approved" }), "fake", database, provider)).resolves.toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    const old = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(old.status).toBe("expired");
    expect(old.payment?.status).toBe("refunded");
    expect((await getBookingPayment(slugs[0], second.data.bookingId, `Bearer ${second.data.accessToken}`, database)).status).toBe("pending_payment");
    const report = await reconcileOnce(database, provider, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
    expect(report.refundsSettled).toBe(0);
    const attempts = await database.select().from(schema.paymentRefunds).where(eq(schema.paymentRefunds.paymentId, first.data.payment!.id));
    expect(attempts).toHaveLength(1);
  });
  it("Pix aprovado depois da margem segue a política de atraso", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const holdEnds = new Date(Date.now() - 10 * 60_000);
    const paidAt = new Date(holdEnds.getTime() + PIX_APPROVAL_TOLERANCE_MS + 1000);
    await database.update(schema.bookings).set({ createdAt: new Date(holdEnds.getTime() - 60_000), expiresAt: holdEnds }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: holdEnds }).where(eq(schema.payments.id, first.data.payment!.id));
    provider.markPaid(first.data.payment!.externalId!, paidAt);
    expect(await processWebhook(webhook(first.data.payment!.externalId!, { paidAt: paidAt.toISOString(), paidAtSource: "date_approved" }), "fake", database, provider)).toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    const booking = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(booking.status).toBe("expired");
    expect(booking.payment?.status).toBe("refunded");
  });
  it("sem hora de aprovação depois do hold cai no atraso", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const holdEnds = new Date(Date.now() - 30_000);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60_000), expiresAt: holdEnds }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: holdEnds }).where(eq(schema.payments.id, first.data.payment!.id));
    provider.markPaid(first.data.payment!.externalId!);
    expect(await processWebhook(webhook(first.data.payment!.externalId!, { paidAtSource: "fallback" }), "fake", database, provider)).toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    const booking = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(booking.status).toBe("expired");
    expect(booking.payment?.status).toBe("refunded");
  });
  it("pagamento tardio com rebook_if_free e horário ocupado registra late_no_slot e estorna", async () => {
    await database.update(schema.businesses).set({ latePaymentPolicy: "rebook_if_free" }).where(eq(schema.businesses.id, businessIds[0]));
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.payments.id, first.data.payment!.id));
    const second = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const paidLate = new Date(Date.now() + PIX_APPROVAL_TOLERANCE_MS);
    provider.markPaid(first.data.payment!.externalId!, paidLate);
    const request = webhook(first.data.payment!.externalId!, { paidAt: paidLate.toISOString(), paidAtSource: "date_approved" });
    const bodyHash = bodyHashes.at(-1)!;
    await expect(processWebhook(request.clone(), "fake", database, provider)).resolves.toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    const old = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(old.status).toBe("expired");
    expect(old.payment?.status).toBe("refunded");
    expect((await getBookingPayment(slugs[0], second.data.bookingId, `Bearer ${second.data.accessToken}`, database)).status).toBe("pending_payment");
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.paymentId, first.data.payment!.id));
    expect(audits.some((row) => row.action === "late_no_slot" && (row.detail as { actor?: string; reason?: string } | null)?.actor === "system")).toBe(true);
    expect(audits.some((row) => row.action === "automatic_refund")).toBe(true);
    const [delivery] = await database.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.bodyHash, bodyHash));
    expect(delivery).toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    await expect(processWebhook(request.clone(), "fake", database, provider)).resolves.toMatchObject({ outcome: "duplicate", reason: "late_no_slot" });
    const attempts = await database.select().from(schema.paymentRefunds).where(eq(schema.paymentRefunds.paymentId, first.data.payment!.id));
    expect(attempts).toHaveLength(1);
  });
  it("desconectado, Pix pago no prazo com webhook depois do vencimento confirma", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const holdEnds = new Date(Date.now() - 60 * 60_000);
    const paidAt = new Date(holdEnds.getTime() - 60_000);
    await disconnectMercadoPago(businessIds[0], { store: createDrizzleMpStore(database) });
    await database.update(schema.bookings).set({ createdAt: new Date(holdEnds.getTime() - 60_000), expiresAt: holdEnds, status: "expired" }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: holdEnds, status: "expired" }).where(eq(schema.payments.id, first.data.payment!.id));
    const store = createDrizzleMpStore(database);
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 0 });
    const [kept] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(kept.status).toBe("disconnected");
    expect(kept.accessTokenEnc).toBeTruthy();
    provider.markPaid(first.data.payment!.externalId!, paidAt);
    expect(await processWebhook(webhook(first.data.payment!.externalId!, { paidAt: paidAt.toISOString(), paidAtSource: "date_approved" }), "fake", database, provider)).toMatchObject({ outcome: "processed", reason: "on_time_reclaimed" });
    const booking = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(booking.status).toBe("confirmed");
    expect(booking.payment?.status).toBe("paid");
    const [after] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(after.accessTokenEnc).toBeTruthy();
  });
  it("desconectado, Pix pago fora do prazo dentro de 24h é devolvido", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const holdEnds = new Date(Date.now() - 60 * 60_000);
    const paidAt = new Date(holdEnds.getTime() + PIX_APPROVAL_TOLERANCE_MS + 1000);
    await disconnectMercadoPago(businessIds[0], { store: createDrizzleMpStore(database) });
    await database.update(schema.bookings).set({ createdAt: new Date(holdEnds.getTime() - 60_000), expiresAt: holdEnds, status: "expired" }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({ expiresAt: holdEnds, status: "expired" }).where(eq(schema.payments.id, first.data.payment!.id));
    const store = createDrizzleMpStore(database);
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 0 });
    const [kept] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(kept.accessTokenEnc).toBeTruthy();
    provider.markPaid(first.data.payment!.externalId!, paidAt);
    expect(await processWebhook(webhook(first.data.payment!.externalId!, { paidAt: paidAt.toISOString(), paidAtSource: "date_approved" }), "fake", database, provider)).toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    const booking = await getBookingPayment(slugs[0], first.data.bookingId, `Bearer ${first.data.accessToken}`, database);
    expect(booking.status).toBe("expired");
    expect(booking.payment?.status).toBe("refunded");
    const [after] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(after.accessTokenEnc).toBeTruthy();
  });
  it("devolução em processamento segura o token depois do vencimento", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const longAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await database.update(schema.bookings).set({ status: "expired", expiresAt: longAgo }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({
      status: "paid",
      paidAt: new Date(longAgo.getTime() + 60_000),
      expiresAt: longAgo,
      refundStatus: "in_process",
    }).where(eq(schema.payments.id, first.data.payment!.id));
    await database.insert(schema.paymentRefunds).values({
      businessId: businessIds[0],
      paymentId: first.data.payment!.id,
      bookingId: first.data.bookingId,
      amountCents: 1000,
      kind: "auto_late",
      status: "processing",
      idempotencyKey: `hold:${first.data.payment!.id}`,
    });
    const store = createDrizzleMpStore(database);
    await disconnectMercadoPago(businessIds[0], { store });
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 0 });
    const [kept] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(kept.accessTokenEnc).toBeTruthy();
    await database.update(schema.paymentRefunds).set({ status: "refunded" }).where(eq(schema.paymentRefunds.paymentId, first.data.payment!.id));
    await database.update(schema.payments).set({ refundStatus: "refunded", refundedAt: new Date() }).where(eq(schema.payments.id, first.data.payment!.id));
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 1 });
    const [gone] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(gone.accessTokenEnc).toBeNull();
  });
  it("devolução pedida segura o token e só apaga depois de liquidar e da folga de 24 h", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const withinGrace = new Date(Date.now() - 60 * 60 * 1000);
    const pastGrace = new Date(withinGrace.getTime() - MP_DISCONNECT_SETTLEMENT_GRACE_MS - 60_000);
    await database.update(schema.bookings).set({ status: "expired", expiresAt: pastGrace }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({
      status: "paid",
      paidAt: new Date(pastGrace.getTime() - 60_000),
      expiresAt: pastGrace,
      refundStatus: null,
    }).where(eq(schema.payments.id, first.data.payment!.id));
    await database.insert(schema.paymentRefunds).values({
      businessId: businessIds[0],
      paymentId: first.data.payment!.id,
      bookingId: first.data.bookingId,
      amountCents: 1000,
      kind: "auto_late",
      status: "requested",
      idempotencyKey: `requested:${first.data.payment!.id}`,
    });
    const store = createDrizzleMpStore(database);
    await disconnectMercadoPago(businessIds[0], { store });
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 0 });
    const [kept] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(kept.accessTokenEnc).toBeTruthy();

    const settledAt = new Date();
    await database.update(schema.paymentRefunds).set({ status: "refunded", finishedAt: settledAt }).where(eq(schema.paymentRefunds.paymentId, first.data.payment!.id));
    await database.update(schema.payments).set({
      refundStatus: "refunded",
      refundedAt: settledAt,
      expiresAt: withinGrace,
    }).where(eq(schema.payments.id, first.data.payment!.id));
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 0 });
    const [waiting] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(waiting.accessTokenEnc).toBeTruthy();

    const afterGrace = new Date(withinGrace.getTime() + MP_DISCONNECT_SETTLEMENT_GRACE_MS + 1_000);
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: afterGrace })).toEqual({ purged: 1 });
    const [gone] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(gone.accessTokenEnc).toBeNull();
    expect(gone.refreshTokenEnc).toBeNull();
  });
  it("creating preso há mais de 7 dias não segura o token e não muda o status", async () => {
    const first = await createBooking(slugs[0], input(), randomUUID(), database, provider);
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    await database.update(schema.bookings).set({ status: "expired", expiresAt: sixDaysAgo }).where(eq(schema.bookings.id, first.data.bookingId));
    await database.update(schema.payments).set({
      status: "creating",
      externalId: null,
      qrCodeDataUrl: null,
      copyPaste: null,
      expiresAt: sixDaysAgo,
    }).where(eq(schema.payments.id, first.data.payment!.id));
    const store = createDrizzleMpStore(database);
    await disconnectMercadoPago(businessIds[0], { store });
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 0 });
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await database.update(schema.payments).set({ expiresAt: eightDaysAgo }).where(eq(schema.payments.id, first.data.payment!.id));
    expect(await purgeDisconnectedMercadoPagoTokens({ store, businessId: businessIds[0], now: new Date() })).toEqual({ purged: 1 });
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.id, first.data.payment!.id));
    expect(payment.status).toBe("creating");
    expect(payment.externalId).toBeNull();
    const [gone] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessIds[0]));
    expect(gone.accessTokenEnc).toBeNull();
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
