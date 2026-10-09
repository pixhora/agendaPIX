import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { createBooking, lockBusiness } from "../../lib/bookings/service";
import { databaseEnvSchema } from "../../lib/env";
import { FakeChargeStore, FakePaymentProvider } from "../../lib/payments/fake";
import { reconcileOnce } from "../../lib/payments/reconcile";
import { applyPaidEvent } from "../../lib/payments/apply-paid";
import { drizzleRefundPorts, settleAutomaticLateRefund } from "../../lib/payments/refund-flow";
import { polledPaidEvent, type ChargeInput, type PaymentProvider } from "../../lib/payments/provider";
import { hash } from "../../lib/bookings/service";
import { padraoPolicyHash } from "../helpers/deposit-policy";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const secret = "test-only-webhook-secret-with-32-characters";
let ownerId: string;
let businessId: string;
let slug: string;
let serviceId: string;
let store: FakeChargeStore;
let provider: FakePaymentProvider;

const slot = (index: number) => new Date(Date.UTC(2030, 0, 1, 12, 0) + index * 1800000).toISOString();
const input = (index = 0, phone = "+5511999999900") => ({ serviceId, startsAt: slot(index), customer: { name: "Cliente", phone, cpfCnpj: "52998224725" }, policyHash: padraoPolicyHash("Negócio") });

beforeEach(async () => {
  ownerId = randomUUID(); businessId = randomUUID(); serviceId = randomUUID(); slug = `out-${businessId}`;
  store = new FakeChargeStore();
  provider = new FakePaymentProvider(secret, { store });
  await database.insert(schema.user).values({ id: ownerId, name: "Dono", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Negócio", slug, latePaymentPolicy: "refund" });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
  await insertConnectedMercadoPago(database, businessId);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await database.delete(schema.paymentAudit).where(eq(schema.paymentAudit.businessId, businessId));
  const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
  const externalIds = payments.flatMap((p) => p.externalId ? [p.externalId] : []);
  if (externalIds.length) {
    await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
    await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.eventId, externalIds.map((id) => `poll:${id}`)));
  }
  await database.delete(schema.paymentRefunds).where(eq(schema.paymentRefunds.businessId, businessId));
  await database.delete(schema.ownerNotices).where(eq(schema.ownerNotices.businessId, businessId));
  await database.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
  await database.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
  await database.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
  await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, businessId));
  await database.delete(schema.services).where(eq(schema.services.businessId, businessId));
  await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
});
afterAll(async () => { await pool.end(); });

describe("cobrança fora da transação", () => {
  it("não segura o lock do negócio durante a latência do gateway", async () => {
    provider.latencyMs = 400;
    const slow = createBooking(slug, input(0), randomUUID(), database, provider);
    // Enquanto a cobrança lenta corre, outro horário do mesmo negócio deve conseguir o lock rapidamente.
    await new Promise((r) => setTimeout(r, 50));
    const started = Date.now();
    await database.transaction(async (tx) => {
      await lockBusiness(tx, businessId);
      expect(Date.now() - started).toBeLessThan(200);
    });
    const result = await slow;
    expect(result.data.payment?.status).toBe("pending");
    expect(result.data.payment?.externalId).toMatch(/^fake_/);
  });

  it("falha/timeout do gateway deixa creating e o replay retoma sem segunda cobrança", async () => {
    // Mínimo aceito por paymentsConfig é 100 ms (abaixo disso o 503 viria da config, não do timeout).
    vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "150");
    provider.latencyMs = 400;
    const key = randomUUID();
    await expect(createBooking(slug, input(0), key, database, provider)).rejects.toMatchObject({ status: 503 });
    expect(store.calls.create).toBe(1);
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
    expect(payment.status).toBe("creating");
    expect(payment.externalId).toBeNull();
    // Gateway pode ter criado a cobrança antes do timeout local: idempotência evita duplicar.
    provider.latencyMs = 0;
    vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "8000");
    const resumed = await createBooking(slug, input(0), key, database, provider);
    expect(resumed.replayed).toBe(true);
    expect(resumed.data.payment?.status).toBe("pending");
    expect(store.byIdempotencyKey.size).toBe(1);
  });

  it("retry após timeout reenvia os dados do pagador e recupera a cobrança já criada no gateway", async () => {
    vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "150");
    provider.latencyMs = 400;
    const inputs: ChargeInput[] = [];
    // Gateway estrito como a regressão do review: sem CPF, recusa ANTES de consultar a referência.
    const strict: PaymentProvider = {
      name: provider.name,
      createPixCharge: async (charge: ChargeInput) => {
        inputs.push(charge);
        // Ignora o abort de propósito: o gateway real conclui a criação mesmo após o timeout local.
        return provider.createPixCharge(charge);
      },
      getCharge: provider.getCharge.bind(provider), findChargeByReference: provider.findChargeByReference.bind(provider),
      cancelCharge: provider.cancelCharge.bind(provider), verifyWebhook: provider.verifyWebhook.bind(provider),
      refundCharge: provider.refundCharge.bind(provider),
    };
    const key = randomUUID();
    await expect(createBooking(slug, input(0), key, database, strict)).rejects.toMatchObject({ status: 503 });
    // O gateway concluiu a criação depois do timeout local.
    expect(inputs).toHaveLength(1);
    expect(store.byIdempotencyKey.size).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(store.byIdempotencyKey.size).toBe(1);
    provider.latencyMs = 0;
    vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "8000");
    const resumed = await createBooking(slug, input(0), key, database, strict);
    expect(resumed.replayed).toBe(true);
    expect(resumed.data.payment?.status).toBe("pending");
    expect(inputs).toHaveLength(2);
    expect(inputs[1].customer).toEqual({ name: "Cliente", phone: "+5511999999900", cpfCnpj: "52998224725" });
    expect(inputs[1].reference).toBe(inputs[0].reference);
    expect(store.byIdempotencyKey.size).toBe(1);
  });

  it("duas retomadas concorrentes de creating não geram duas cobranças", async () => {
    const key = randomUUID();
    const broken = { name: provider.name, createPixCharge: async () => { throw new Error("fail"); }, getCharge: provider.getCharge.bind(provider), findChargeByReference: provider.findChargeByReference.bind(provider), cancelCharge: provider.cancelCharge.bind(provider), verifyWebhook: provider.verifyWebhook.bind(provider), refundCharge: provider.refundCharge.bind(provider) };
    await expect(createBooking(slug, input(0), key, database, broken)).rejects.toMatchObject({ status: 503 });
    const results = await Promise.allSettled([
      createBooking(slug, input(0), key, database, provider),
      createBooking(slug, input(0), key, database, provider),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(store.byIdempotencyKey.size).toBe(1);
    const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("pending");
  });
});

describe("reconciliação", () => {
  it("retoma creating preso (> stuck seconds) e anexa o QR", async () => {
    const broken = { name: provider.name, createPixCharge: async () => { throw new Error("fail"); }, getCharge: provider.getCharge.bind(provider), findChargeByReference: provider.findChargeByReference.bind(provider), cancelCharge: provider.cancelCharge.bind(provider), verifyWebhook: provider.verifyWebhook.bind(provider), refundCharge: provider.refundCharge.bind(provider) };
    await expect(createBooking(slug, input(0), randomUUID(), database, broken)).rejects.toMatchObject({ status: 503 });
    await database.update(schema.payments).set({ updatedAt: new Date(Date.now() - 120_000) }).where(eq(schema.payments.businessId, businessId));
    const report = await reconcileOnce(database, provider, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
    expect(report.stuckRetried).toBe(1);
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
    expect(payment.status).toBe("pending");
    expect(payment.externalId).toBeTruthy();
  });

  it("cancela no gateway cobranças pending já vencidas", async () => {
    const { data } = await createBooking(slug, input(0), randomUUID(), database, provider);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.bookings.id, data.bookingId));
    await database.update(schema.payments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.payments.id, data.payment!.id));
    const report = await reconcileOnce(database, provider, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
    expect(report.expiredCancelled).toBe(1);
    expect(await provider.getCharge(data.payment!.externalId!)).toMatchObject({ status: "cancelled" });
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    expect(payment.status).toBe("expired");
  });

  it("descobre pagamento perdido pelo webhook via poll", async () => {
    const { data } = await createBooking(slug, input(0), randomUUID(), database, provider);
    provider.markPaid(data.payment!.externalId!);
    const report = await reconcileOnce(database, provider, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
    expect(report.polledPaid).toBe(1);
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    expect(booking.status).toBe("confirmed");
  });

  it("pagamento tardio com política refund marca refund_pending e audita", async () => {
    const { data } = await createBooking(slug, input(0), randomUUID(), database, provider);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() - 1000), status: "expired" }).where(eq(schema.bookings.id, data.bookingId));
    await database.update(schema.payments).set({ expiresAt: new Date(Date.now() - 1000), status: "expired" }).where(eq(schema.payments.id, data.payment!.id));
    // Outro cliente pega o horário
    await createBooking(slug, input(0, "+5511999999901"), randomUUID(), database, provider);
    const charge = provider.markPaid(data.payment!.externalId!);
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result).toMatchObject({ outcome: "ignored", reason: "late_no_slot" });
    });
    const callsBefore = store.calls.refund;
    expect(await settleAutomaticLateRefund(drizzleRefundPorts(database), provider, data.payment!.id, async () => {})).toBe("submitted");
    expect(store.calls.refund).toBe(callsBefore + 1);
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    expect(payment.status).toBe("refunded");
    expect(payment.refundStatus).toBe("refunded");
    const [lateBooking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    expect(lateBooking.status).toBe("expired");
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.paymentId, data.payment!.id));
    expect(audits.some((a) => a.action === "late_no_slot" && (a.detail as { actor?: string; reason?: string } | null)?.actor === "system")).toBe(true);
    expect(audits.some((a) => a.action === "automatic_refund")).toBe(true);
    expect(await settleAutomaticLateRefund(drizzleRefundPorts(database), provider, data.payment!.id, async () => {})).toBe("done");
    expect(store.calls.refund).toBe(callsBefore + 1);
  });

  it("pagamento tardio com rebook_if_free confirma se o horário estiver livre", async () => {
    await database.update(schema.businesses).set({ latePaymentPolicy: "rebook_if_free" }).where(eq(schema.businesses.id, businessId));
    const { data } = await createBooking(slug, input(0), randomUUID(), database, provider);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() - 1000), status: "expired" }).where(eq(schema.bookings.id, data.bookingId));
    await database.update(schema.payments).set({ expiresAt: new Date(Date.now() - 1000), status: "expired" }).where(eq(schema.payments.id, data.payment!.id));
    const charge = provider.markPaid(data.payment!.externalId!);
    await database.transaction(async (tx) => {
      expect(await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date())).toMatchObject({ outcome: "processed", reason: "late_rebooked" });
    });
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    expect(booking.status).toBe("confirmed");
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    expect(payment.status).toBe("paid");
  });

  it("sem provedor disponível (produção sem Mercado Pago) ainda expira holds e creating vencidos", async () => {
    const broken = { name: provider.name, createPixCharge: async () => { throw new Error("fail"); }, getCharge: provider.getCharge.bind(provider), findChargeByReference: provider.findChargeByReference.bind(provider), cancelCharge: provider.cancelCharge.bind(provider), verifyWebhook: provider.verifyWebhook.bind(provider), refundCharge: provider.refundCharge.bind(provider) };
    const { data: pending } = await createBooking(slug, input(0), randomUUID(), database, provider);
    await expect(createBooking(slug, input(1, "+5511999999901"), randomUUID(), database, broken)).rejects.toMatchObject({ status: 503 });
    const past = new Date(Date.now() - 1000);
    await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60_000), expiresAt: past }).where(eq(schema.bookings.businessId, businessId));
    await database.update(schema.payments).set({ expiresAt: past }).where(eq(schema.payments.businessId, businessId));
    const report = await reconcileOnce(database, null, { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 });
    expect(report).toMatchObject({ skippedLock: false, stuckCancelled: 1, expiredCancelled: 1, polledPaid: 0 });
    const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
    expect(payments.map((p) => p.status).sort()).toEqual(["expired", "expired"]);
    const bookings = await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, businessId));
    expect(bookings.every((b) => b.status === "expired")).toBe(true);
    // Gateway não é tocado sem provedor: cancelamento remoto fica para o próximo ciclo (cancelExpiredPending).
    expect(store.calls.cancel).toBe(0);
    expect(await provider.getCharge(pending.payment!.externalId!)).toMatchObject({ status: "pending" });
  });

  it("reconcilers concorrentes: só um executa o trabalho", async () => {
    const { data } = await createBooking(slug, input(0), randomUUID(), database, provider);
    provider.markPaid(data.payment!.externalId!);
    const config = { PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_INTERVAL_SECONDS: 60, RECONCILE_STUCK_SECONDS: 60, RECONCILE_BATCH_SIZE: 50, RECONCILE_BUDGET_MS: 50_000 };
    // Duas conexões distintas para advisory locks de sessão.
    const pool2 = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 2 });
    const db2 = drizzle(pool2, { schema });
    try {
      const results = await Promise.all([reconcileOnce(database, provider, config), reconcileOnce(db2, provider, config)]);
      expect(results.some((r) => r.skippedLock)).toBe(true);
      expect(results.some((r) => r.polledPaid === 1 || r.audits >= 1)).toBe(true);
    } finally {
      await pool2.end();
    }
  });
});
