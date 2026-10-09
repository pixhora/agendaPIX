import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/public/[slug]/bookings/[id]/payment/route";
import * as schema from "../../db/schema";
import { bookingConfig } from "../../lib/bookings/config";
import { createBooking, getBookingPayment, hash } from "../../lib/bookings/service";
import { paymentGatewayPollHash } from "../../lib/bookings/rate-limit";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider, signFakeWebhook } from "../../lib/payments/fake";
import { processWebhook } from "../../lib/payments/webhook";
import { padraoPolicyHash } from "../helpers/deposit-policy";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const secret = "test-only-webhook-secret-with-32-characters";
const provider = new FakePaymentProvider(secret);
const bodyHashes: string[] = [];
let ownerId: string;
let businessId: string;
let slug: string;
let serviceId: string;

const input = () => ({
  serviceId,
  startsAt: "2030-01-01T12:00:00Z",
  customer: { name: "Cliente de teste", phone: "+5511999999999", cpfCnpj: "52998224725" },
  policyHash: padraoPolicyHash("Negócio de teste"),
});

beforeEach(async () => {
  bodyHashes.length = 0;
  ownerId = randomUUID();
  businessId = randomUUID();
  serviceId = randomUUID();
  slug = `poll-${businessId}`;
  await database.insert(schema.user).values({ id: ownerId, name: "Dono de teste", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Negócio de teste", slug });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
  await insertConnectedMercadoPago(database, businessId);
});

afterEach(async () => {
  await database.delete(schema.paymentAudit).where(eq(schema.paymentAudit.businessId, businessId));
  await database.delete(schema.paymentRefunds).where(eq(schema.paymentRefunds.businessId, businessId));
  await database.delete(schema.ownerNotices).where(eq(schema.ownerNotices.businessId, businessId));
  const payments = await database.select({ externalId: schema.payments.externalId }).from(schema.payments).where(eq(schema.payments.businessId, businessId));
  const externalIds = payments.flatMap((row) => row.externalId ? [row.externalId] : []);
  if (externalIds.length) await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
  if (bodyHashes.length) await database.delete(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.bodyHash, bodyHashes));
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

function mentionsAdvisoryLock(query: unknown) {
  const seen = new Set<unknown>();
  const visit = (value: unknown): boolean => {
    if (typeof value === "string") return value.includes("pg_advisory");
    if (!value || typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    return Object.values(value as Record<string, unknown>).some(visit);
  };
  return visit(query);
}

function watchedDatabase() {
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === "transaction" || property === "update" || property === "insert" || property === "delete") {
        return () => { throw new Error(`escrita inesperada: ${String(property)}`); };
      }
      if (property === "execute") {
        return (query: unknown) => {
          if (mentionsAdvisoryLock(query)) throw new Error("lock inesperado");
          return target.execute(query as never);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

async function race<T>(run: Promise<T>, ms = 1500) {
  const pending = run.then((value) => value, (error: unknown) => error);
  return Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve("blocked"), ms))]);
}

describe("consulta pública do Pix", () => {
  it("deriva o vencido sem gravar reserva nem cobrança", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const createdAt = new Date(Date.now() - 60_000);
    const expiresAt = new Date(Date.now() - 1000);
    await database.update(schema.bookings).set({ createdAt, expiresAt }).where(eq(schema.bookings.id, data.bookingId));
    await database.update(schema.payments).set({ expiresAt }).where(eq(schema.payments.id, data.payment!.id));
    const [bookingBefore] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    const [paymentBefore] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));

    const view = await getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database);

    expect(view.status).toBe("expired");
    expect(view.payment?.status).toBe("expired");
    expect(view.payment?.qrCodeDataUrl).toBeNull();
    expect(view.payment?.copyPaste).toBeNull();
    expect(view.expiresAt).toEqual(expiresAt);
    const [bookingAfter] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    const [paymentAfter] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    expect(bookingAfter).toMatchObject({ status: "pending_payment", updatedAt: bookingBefore.updatedAt });
    expect(paymentAfter).toMatchObject({ status: "pending", copyPaste: paymentBefore.copyPaste, qrCodeDataUrl: paymentBefore.qrCodeDataUrl, updatedAt: paymentBefore.updatedAt });
  });

  it("token inválido não pega o lock nem grava, e a consulta válida também não espera o lock", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const sealed = new Proxy(database, {
      get() { return () => { throw new Error("banco inesperado"); }; },
    });
    await expect(getBookingPayment(slug, data.bookingId, null, sealed)).rejects.toMatchObject({ status: 404, code: "booking_not_found" });
    await expect(getBookingPayment(slug, data.bookingId, "Bearer curto", sealed)).rejects.toMatchObject({ status: 404, code: "booking_not_found" });

    const watched = watchedDatabase();
    await expect(getBookingPayment(slug, data.bookingId, `Bearer ${"a".repeat(43)}`, watched)).rejects.toMatchObject({ status: 404, code: "booking_not_found" });
    const [untouched] = await database.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, businessId), eq(schema.bookings.id, data.bookingId)));
    expect(untouched.status).toBe("pending_payment");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [businessId]);
      const denied = await race(getBookingPayment(slug, data.bookingId, `Bearer ${"b".repeat(43)}`, database));
      expect(denied).toMatchObject({ status: 404, code: "booking_not_found" });
      const allowed = await race(getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database));
      expect(allowed).toMatchObject({ status: "pending_payment", payment: { status: "pending" } });
      expect((allowed as { payment: { copyPaste: string | null } }).payment.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("cabe a cadência de 4 segundos e corta o excesso sem gravar a reserva", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const open = bookingConfig({});
    expect(open.PAYMENT_POLL_RATE_LIMIT_PER_CLIENT).toBeGreaterThanOrEqual(15);
    const identity = "peer:203.0.113.10";
    for (let attempt = 0; attempt < 15; attempt += 1) {
      expect((await getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database, identity, open)).status).toBe("pending_payment");
    }

    const tight = bookingConfig({ PAYMENT_POLL_RATE_LIMIT_PER_CLIENT: "2", PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS: "30" });
    const other = "peer:203.0.113.11";
    await getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database, other, tight);
    await expect(getBookingPayment(slug, data.bookingId, `Bearer ${"c".repeat(43)}`, database, other, tight)).rejects.toMatchObject({ status: 404, code: "booking_not_found" });
    await expect(getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database, other, tight)).rejects.toMatchObject({
      status: 429, code: "rate_limited", retryAfterSeconds: 60,
    });
    const [stillPending] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    expect(stillPending.status).toBe("pending_payment");
  });

  it("responde 429 rate_limited no formato da API", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const previousClient = process.env.PAYMENT_POLL_RATE_LIMIT_PER_CLIENT;
    const previousBusiness = process.env.PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS;
    process.env.PAYMENT_POLL_RATE_LIMIT_PER_CLIENT = "1";
    process.env.PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS = "30";
    try {
      const call = () => GET(new Request(`http://localhost/api/public/${slug}/bookings/${data.bookingId}/payment`, {
        headers: { authorization: `Bearer ${data.accessToken}`, "x-forwarded-for": "203.0.113.12" },
      }), { params: Promise.resolve({ slug, id: data.bookingId }) });
      expect((await call()).status).toBe(200);
      const limited = await call();
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBe("60");
      expect(limited.headers.get("cache-control")).toContain("no-store");
      expect(await limited.json()).toEqual({
        error: { code: "rate_limited", message: "Muitas consultas. Aguarde um minuto e tente novamente." },
      });
    } finally {
      if (previousClient === undefined) delete process.env.PAYMENT_POLL_RATE_LIMIT_PER_CLIENT;
      else process.env.PAYMENT_POLL_RATE_LIMIT_PER_CLIENT = previousClient;
      if (previousBusiness === undefined) delete process.env.PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS;
      else process.env.PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS = previousBusiness;
    }
  });

  function webhook(externalId: string) {
    const body = JSON.stringify({ eventId: randomUUID(), type: "payment.paid", externalId, amountCents: 1000, paidAt: new Date().toISOString() });
    bodyHashes.push(hash(body));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({ "content-type": "application/json", "x-fake-timestamp": timestamp, "x-fake-signature": signFakeWebhook(body, timestamp, secret) });
    return new Request("http://localhost/api/webhooks/payments/fake", { method: "POST", headers, body });
  }

  it("confirma Pix pago sem webhook", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const externalId = data.payment!.externalId!;
    provider.markPaid(externalId);
    const callsBefore = provider.store.calls.get;

    const view = await getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database, null, bookingConfig({}), { provider });

    expect(view.status).toBe("confirmed");
    expect(view.payment).toMatchObject({ status: "paid", qrCodeDataUrl: null, copyPaste: null });
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    expect(booking.status).toBe("confirmed");
    expect(payment.status).toBe("paid");
    const events = await database.select().from(schema.paymentEvents).where(eq(schema.paymentEvents.externalId, externalId));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventId: `poll:${externalId}`, outcome: "processed" });
    expect(await database.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.eventId, events[0].eventId))).toHaveLength(0);
    expect(provider.store.calls.get).toBe(callsBefore + 1);

    await getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database, null, bookingConfig({}), { provider });
    expect(provider.store.calls.get).toBe(callsBefore + 1);
  });

  it("consulta o gateway no máximo uma vez a cada 20 segundos", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const poll = { provider } as const;
    const token = `Bearer ${data.accessToken}`;
    const before = provider.store.calls.get;

    expect((await getBookingPayment(slug, data.bookingId, token, database, null, bookingConfig({}), poll)).status).toBe("pending_payment");
    expect(provider.store.calls.get).toBe(before + 1);
    expect((await getBookingPayment(slug, data.bookingId, token, database, null, bookingConfig({}), poll)).payment?.status).toBe("pending");
    expect(provider.store.calls.get).toBe(before + 1);

    await database.execute(sql`UPDATE booking_rate_limits SET window_started_at = now() - interval '21 seconds'
      WHERE business_id = ${businessId} AND client_hash = ${paymentGatewayPollHash(businessId, data.payment!.id)}`);
    await getBookingPayment(slug, data.bookingId, token, database, null, bookingConfig({}), poll);
    expect(provider.store.calls.get).toBe(before + 2);
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    expect(booking.status).toBe("pending_payment");
  });

  it("timeout do gateway continua pending e não vira erro", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const slow = new FakePaymentProvider(secret, { store: provider.store, latencyMs: 5_000 });
    const [bookingBefore] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    const [paymentBefore] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    const started = Date.now();

    const view = await getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database, null, bookingConfig({}), { provider: slow, timeoutMs: 30 });

    expect(Date.now() - started).toBeLessThan(1_500);
    expect(view).toMatchObject({ status: "pending_payment", payment: { status: "pending" } });
    expect(view.payment?.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
    const [bookingAfter] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    const [paymentAfter] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    expect(bookingAfter).toMatchObject({ status: "pending_payment", updatedAt: bookingBefore.updatedAt });
    expect(paymentAfter).toMatchObject({ status: "pending", updatedAt: paymentBefore.updatedAt });
  });

  it("webhook e GET concorrentes confirmam uma vez só", async () => {
    const { data } = await createBooking(slug, input(), randomUUID(), database, provider);
    const externalId = data.payment!.externalId!;
    provider.markPaid(externalId);

    const [view, webhookResult] = await Promise.all([
      getBookingPayment(slug, data.bookingId, `Bearer ${data.accessToken}`, database, null, bookingConfig({}), { provider }),
      processWebhook(webhook(externalId), "fake", database, provider),
    ]);

    expect(view.status).toBe("confirmed");
    expect(view.payment?.status).toBe("paid");
    expect(["processed", "duplicate"]).toContain(webhookResult.outcome);
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.id, data.payment!.id));
    expect(booking.status).toBe("confirmed");
    expect(payment.status).toBe("paid");
    expect(payment.paidAt).toBeInstanceOf(Date);
    const events = await database.select().from(schema.paymentEvents).where(eq(schema.paymentEvents.externalId, externalId));
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.outcome).sort()).toEqual(["duplicate", "processed"]);
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.paymentId, payment.id));
    expect(audits.filter((row) => row.action === "payment_confirmed")).toHaveLength(1);
  });
});
