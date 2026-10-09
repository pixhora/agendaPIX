import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/public/[slug]/bookings/[id]/payment/route";
import * as schema from "../../db/schema";
import { bookingConfig } from "../../lib/bookings/config";
import { createBooking, getBookingPayment } from "../../lib/bookings/service";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider } from "../../lib/payments/fake";
import { padraoPolicyHash } from "../helpers/deposit-policy";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const secret = "test-only-webhook-secret-with-32-characters";
const provider = new FakePaymentProvider(secret);
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
});
