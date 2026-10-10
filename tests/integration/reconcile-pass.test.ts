import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { createBooking } from "../../lib/bookings/service";
import { databaseEnvSchema } from "../../lib/env";
import { FakeChargeStore, FakePaymentProvider } from "../../lib/payments/fake";
import type { PaymentProvider } from "../../lib/payments/provider";
import { reconcileOnce, type ReconcileBudget, type ReconcileStage } from "../../lib/payments/reconcile";
import { MpAccountNotConnectedError } from "../../lib/payments/seller-account";
import type { PaymentsConfig } from "../../lib/payments/config";
import { padraoPolicyHash } from "../helpers/deposit-policy";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const secret = "test-only-webhook-secret-with-32-characters";
const config: PaymentsConfig = {
  PAYMENT_PROVIDER_TIMEOUT_MS: 8000,
  RECONCILE_INTERVAL_SECONDS: 60,
  RECONCILE_STUCK_SECONDS: 60,
  RECONCILE_BATCH_SIZE: 50,
  RECONCILE_BUDGET_MS: 50_000,
};
const openBudget: ReconcileBudget = { allow: () => true };

let ownerId: string;
let businessId: string;
let slug: string;
let serviceId: string;
let store: FakeChargeStore;
let provider: FakePaymentProvider;
let logs: string[];

const slot = (index: number) => new Date(Date.UTC(2030, 0, 1, 12, 0) + index * 1800000).toISOString();
const input = (index = 0, phone = "+5511999999900") => ({
  serviceId, startsAt: slot(index), customer: { name: "Cliente", phone, cpfCnpj: "52998224725" }, policyHash: padraoPolicyHash("Negócio"),
});

function bindProvider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    name: provider.name,
    createPixCharge: provider.createPixCharge.bind(provider),
    getCharge: provider.getCharge.bind(provider),
    findChargeByReference: provider.findChargeByReference.bind(provider),
    cancelCharge: provider.cancelCharge.bind(provider),
    refundCharge: provider.refundCharge.bind(provider),
    verifyWebhook: provider.verifyWebhook.bind(provider),
    ...overrides,
  };
}

beforeEach(async () => {
  ownerId = randomUUID(); businessId = randomUUID(); serviceId = randomUUID(); slug = `rec-${businessId}`;
  store = new FakeChargeStore();
  provider = new FakePaymentProvider(secret, { store });
  logs = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logs.push(args.map((part) => String(part)).join(" "));
  });
  await database.insert(schema.user).values({ id: ownerId, name: "Dono", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Negócio", slug, latePaymentPolicy: "refund" });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
  await insertConnectedMercadoPago(database, businessId);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete(schema.paymentAudit).where(eq(schema.paymentAudit.businessId, businessId));
  const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
  const externalIds = payments.flatMap((payment) => payment.externalId ? [payment.externalId] : []);
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

async function backdate(paymentId: string, bookingId: string, expiresAt: Date) {
  await database.update(schema.bookings).set({ createdAt: new Date(expiresAt.getTime() - 60_000), expiresAt }).where(eq(schema.bookings.id, bookingId));
  await database.update(schema.payments).set({ expiresAt, updatedAt: new Date(expiresAt.getTime() - 120_000) }).where(eq(schema.payments.id, paymentId));
}

describe("reconciliação isola falha e não reprocessa cancelamento", () => {
  it("um creating vencido que estoura no gateway não impede cancelar o vencido nem o polling", async () => {
    const broken = bindProvider({ createPixCharge: async () => { throw new Error("fail"); } });
    await expect(createBooking(slug, input(0), randomUUID(), database, broken)).rejects.toMatchObject({ status: 503 });
    const [stuck] = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
    const expired = await createBooking(slug, input(1, "+5511999999901"), randomUUID(), database, provider);
    const polled = await createBooking(slug, input(2, "+5511999999902"), randomUUID(), database, provider);
    const past = new Date(Date.now() - 60_000);
    await backdate(stuck.id, stuck.bookingId, past);
    await backdate(expired.data.payment!.id, expired.data.bookingId, new Date(Date.now() - 30_000));
    provider.markPaid(polled.data.payment!.externalId!);
    const flaky = bindProvider({
      findChargeByReference: async (reference, options) => {
        if (reference === stuck.id) throw new Error("timeout Bearer super-secret dono@salao.com");
        return provider.findChargeByReference(reference, options);
      },
    });

    const report = await reconcileOnce(database, flaky, config, new Date(), openBudget);

    expect(report.failures).toBeGreaterThanOrEqual(1);
    expect(report.expiredCancelled).toBe(1);
    expect(report.polledPaid).toBe(1);
    expect(await provider.getCharge(expired.data.payment!.externalId!)).toMatchObject({ status: "cancelled" });
    const [confirmed] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, polled.data.bookingId));
    expect(confirmed.status).toBe("confirmed");
    const [released] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, stuck.bookingId));
    expect(released.status).toBe("expired");
    const text = `${JSON.stringify(report)}\n${logs.join("\n")}`;
    expect(text).not.toContain("dono@salao.com");
    expect(text).not.toContain("Bearer");
    expect(logs.some((line) => line.includes("code=reconcile_failed") && line.includes(stuck.id))).toBe(true);
  });

  it("sem token, creating vencido expira no local e o polling do outro pagamento ainda roda", async () => {
    const broken = bindProvider({ createPixCharge: async () => { throw new Error("fail"); } });
    await expect(createBooking(slug, input(0), randomUUID(), database, broken)).rejects.toMatchObject({ status: 503 });
    const [stuck] = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
    const polled = await createBooking(slug, input(1, "+5511999999901"), randomUUID(), database, provider);
    await backdate(stuck.id, stuck.bookingId, new Date(Date.now() - 60_000));
    provider.markPaid(polled.data.payment!.externalId!);
    const disconnected = bindProvider({
      findChargeByReference: async () => { throw new MpAccountNotConnectedError(); },
    });

    const report = await reconcileOnce(database, disconnected, config, new Date(), openBudget);

    expect(report.failures).toBeGreaterThanOrEqual(1);
    expect(report.stuckCancelled).toBeGreaterThanOrEqual(1);
    expect(report.polledPaid).toBe(1);
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.id, stuck.id));
    expect(payment.status).toBe("expired");
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, stuck.bookingId));
    expect(booking.status).toBe("expired");
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.paymentId, stuck.id));
    expect(audits.some((row) => row.action === "stuck_creating_expired" && (row.detail as { reason?: string } | null)?.reason === "mp_account_not_connected")).toBe(true);
    expect(logs.join("\n")).toContain("code=mp_account_not_connected");
  });

  it("Pix vencido de negócio sem Mercado Pago conectado falha uma vez, fecha com auditoria e não repete", async () => {
    const created = await createBooking(slug, input(0), randomUUID(), database, provider);
    await backdate(created.data.payment!.id, created.data.bookingId, new Date(Date.now() - 60_000));
    const calls: string[] = [];
    const disconnected = bindProvider({
      cancelCharge: async (externalId) => {
        calls.push(externalId);
        throw new MpAccountNotConnectedError();
      },
    });

    const first = await reconcileOnce(database, disconnected, config, new Date(), openBudget);

    expect(first.failures).toBeGreaterThanOrEqual(1);
    expect(logs.join("\n")).toContain("stage=cancel");
    expect(logs.join("\n")).toContain("code=mp_account_not_connected");
    const [closed] = await database.select().from(schema.payments).where(eq(schema.payments.id, created.data.payment!.id));
    expect(closed.remoteCancelledAt).not.toBeNull();
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.paymentId, created.data.payment!.id));
    expect(audits.some((row) => row.action === "expired_pending_cancel_skipped" && (row.detail as { reason?: string } | null)?.reason === "mp_account_not_connected")).toBe(true);
    expect(audits.some((row) => row.action === "expired_pending_cancelled")).toBe(false);

    await reconcileOnce(database, disconnected, config, new Date(), openBudget);

    expect(calls).toHaveLength(1);
  });

  it("não cancela de novo quem já foi cancelado e, no meio do orçamento, ainda faz o polling", async () => {
    const older = await createBooking(slug, input(0), randomUUID(), database, provider);
    const newer = await createBooking(slug, input(1, "+5511999999901"), randomUUID(), database, provider);
    const polled = await createBooking(slug, input(2, "+5511999999902"), randomUUID(), database, provider);
    await backdate(older.data.payment!.id, older.data.bookingId, new Date(Date.now() - 10 * 60_000));
    await backdate(newer.data.payment!.id, newer.data.bookingId, new Date(Date.now() - 60_000));
    provider.markPaid(polled.data.payment!.externalId!);
    const olderExternal = older.data.payment!.externalId!;
    const newerExternal = newer.data.payment!.externalId!;
    let fail = true;
    const order: string[] = [];
    const flaky = bindProvider({
      cancelCharge: async (externalId, options) => {
        order.push(externalId);
        if (fail) throw new Error("mp 500 payer dono@salao.com");
        return provider.cancelCharge(externalId, options);
      },
    });
    let cancelSlots = 1;
    const tight: ReconcileBudget = {
      allow(stage: ReconcileStage) {
        if (stage !== "cancel") return true;
        return cancelSlots-- > 0;
      },
    };

    const first = await reconcileOnce(database, flaky, config, new Date(), tight);
    expect(first.failures).toBeGreaterThanOrEqual(1);
    expect(first.deferred).toBeGreaterThanOrEqual(1);
    expect(first.expiredCancelled).toBe(0);
    expect(first.polledPaid).toBe(1);
    const [attempted] = await database.select().from(schema.payments).where(eq(schema.payments.id, older.data.payment!.id));
    const [waiting] = await database.select().from(schema.payments).where(eq(schema.payments.id, newer.data.payment!.id));
    expect(attempted.remoteCancelAttemptedAt).toBeTruthy();
    expect(attempted.remoteCancelledAt).toBeNull();
    expect(waiting.remoteCancelAttemptedAt).toBeNull();
    expect(order).toEqual([olderExternal]);

    fail = false;
    order.length = 0;
    const second = await reconcileOnce(database, flaky, config, new Date(), openBudget);
    expect(second.expiredCancelled).toBe(2);
    expect(order).toEqual([newerExternal, olderExternal]);
    const after = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
    expect(after.filter((payment) => payment.id !== polled.data.payment!.id).every((payment) => payment.remoteCancelledAt !== null)).toBe(true);

    const calls = store.calls.cancel;
    const third = await reconcileOnce(database, flaky, config, new Date(), openBudget);
    expect(third.expiredCancelled).toBe(0);
    expect(store.calls.cancel).toBe(calls);
    expect(`${JSON.stringify(first)}\n${logs.join("\n")}`).not.toContain("dono@salao.com");
  });
});
