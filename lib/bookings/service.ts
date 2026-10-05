import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { authEnvSchema } from "../env";
import { HttpError } from "../http";
import { getPaymentProvider } from "../payments";
import { pixChargeSchema, type PaymentProvider } from "../payments/provider";
import { availableSlots, localDate } from "./availability";
import { availabilitySchema, bookingInputSchema, requestKeySchema, slugSchema } from "./validation";
import { bookingConfig } from "./config";
import { consumeBookingRateLimit } from "./rate-limit";

type Database = NodePgDatabase<typeof schema>;
export function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function chargeIdempotencyKey(businessId: string, requestKey: string) {
  const bytes = Buffer.from(hash(`pix-charge:v1:${businessId}:${requestKey}`).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
function accessToken(businessId: string, bookingId: string) {
  const env = authEnvSchema.safeParse(process.env);
  if (!env.success) throw new HttpError(503, "booking_unavailable", "Agendamento indisponível. Tente novamente mais tarde.");
  return createHmac("sha256", env.data.BETTER_AUTH_SECRET).update(`booking-access:v1:${businessId}:${bookingId}`).digest("base64url");
}
export async function lockBusiness(database: Database, businessId: string) {
  await database.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${businessId}, 0))`);
}
export async function expirePending(database: Database, businessId: string, now: Date) {
  await database.update(schema.bookings).set({ status: "expired" }).where(and(eq(schema.bookings.businessId, businessId), eq(schema.bookings.status, "pending_payment"), lte(schema.bookings.expiresAt, now)));
  await database.update(schema.payments).set({ status: "expired" }).where(and(eq(schema.payments.businessId, businessId), eq(schema.payments.status, "pending"), lte(schema.payments.expiresAt, now)));
}
async function businessBySlug(slug: string, database: Database) {
  const [business] = await database.select().from(schema.businesses).where(eq(schema.businesses.slug, slugSchema.parse(slug))).limit(1);
  if (!business) throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
  return business;
}
async function serviceById(businessId: string, serviceId: string, database: Database) {
  const [service] = await database.select().from(schema.services).where(and(eq(schema.services.businessId, businessId), eq(schema.services.id, serviceId), eq(schema.services.active, true))).limit(1);
  if (!service) throw new HttpError(404, "service_not_found", "Serviço não encontrado.");
  return service;
}
export async function listPublicServices(slug: string, database: Database = getDb()) {
  const business = await businessBySlug(slug, database);
  const services = await database.select({ id: schema.services.id, name: schema.services.name, durationMinutes: schema.services.durationMinutes, priceCents: schema.services.priceCents, depositCents: schema.services.depositCents }).from(schema.services).where(and(eq(schema.services.businessId, business.id), eq(schema.services.active, true)));
  return { name: business.name, timezone: business.timezone, services };
}
async function slotsFor(business: typeof schema.businesses.$inferSelect, service: typeof schema.services.$inferSelect, date: string, now: Date, database: Database) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [hours] = await database.select().from(schema.businessHours).where(and(eq(schema.businessHours.businessId, business.id), eq(schema.businessHours.weekday, weekday))).limit(1);
  const day = Date.parse(`${date}T00:00:00Z`);
  const busy = await database.select({ startsAt: schema.bookings.startsAt, endsAt: schema.bookings.endsAt }).from(schema.bookings).where(and(
    eq(schema.bookings.businessId, business.id), lt(schema.bookings.startsAt, new Date(day + 172800000)), gt(schema.bookings.endsAt, new Date(day - 86400000)),
    or(inArray(schema.bookings.status, ["confirmed", "completed"]), and(eq(schema.bookings.status, "pending_payment"), gt(schema.bookings.expiresAt, now))),
  ));
  return availableSlots({ date, timezone: business.timezone, durationMinutes: service.durationMinutes, hours: hours ?? null, busy, now });
}
export async function getAvailability(slug: string, query: unknown, database: Database = getDb()) {
  const input = availabilitySchema.parse(query);
  const business = await businessBySlug(slug, database);
  const service = await serviceById(business.id, input.serviceId, database);
  return { timezone: business.timezone, slots: await slotsFor(business, service, input.date, new Date(), database) };
}
function paymentView(payment: typeof schema.payments.$inferSelect | undefined, now: Date) {
  if (!payment) return null;
  const usable = payment.status === "pending" && payment.expiresAt > now;
  return { id: payment.id, provider: payment.provider, externalId: payment.externalId, amountCents: payment.amountCents, status: payment.status, expiresAt: payment.expiresAt,
    qrCodeDataUrl: usable ? payment.qrCodeDataUrl : null, copyPaste: usable ? payment.copyPaste : null };
}
async function bookingView(booking: typeof schema.bookings.$inferSelect, database: Database, now: Date) {
  const [payment] = await database.select().from(schema.payments).where(and(eq(schema.payments.businessId, booking.businessId), eq(schema.payments.bookingId, booking.id))).limit(1);
  return { bookingId: booking.id, status: booking.status, startsAt: booking.startsAt, endsAt: booking.endsAt, expiresAt: booking.expiresAt, payment: paymentView(payment, now) };
}

export async function createBooking(slug: string, body: unknown, key: unknown, database: Database = getDb(), provider?: PaymentProvider, clientIdentity: string | null = null) {
  const config = bookingConfig();
  const input = bookingInputSchema.parse(body);
  const requestKey = requestKeySchema.parse(key);
  const requestHash = hash(JSON.stringify(input));
  const business = await businessBySlug(slug, database);
  await consumeBookingRateLimit(database, business.id, clientIdentity, config);
  return database.transaction(async (transaction) => {
    await lockBusiness(transaction, business.id);
    const now = new Date();
    await expirePending(transaction, business.id, now);
    const [existing] = await transaction.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.requestKey, requestKey))).limit(1);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new HttpError(409, "idempotency_conflict", "Essa chave já foi usada em outro agendamento.");
      return { replayed: true, data: { ...await bookingView(existing, transaction, now), accessToken: accessToken(business.id, existing.id) } };
    }
    const service = await serviceById(business.id, input.serviceId, transaction);
    const date = localDate(new Date(input.startsAt), business.timezone);
    const slots = await slotsFor(business, service, date, now, transaction);
    const slot = slots.find((candidate) => candidate.startsAt.toISOString() === input.startsAt);
    if (!slot) throw new HttpError(409, "slot_unavailable", "Esse horário não está disponível. Escolha outro.");
    const [insertedCustomer] = await transaction.insert(schema.customers).values({ businessId: business.id, ...input.customer }).onConflictDoNothing({ target: [schema.customers.businessId, schema.customers.phone] }).returning({ id: schema.customers.id });
    const [existingCustomer] = insertedCustomer ? [] : await transaction.select({ id: schema.customers.id }).from(schema.customers).where(and(eq(schema.customers.businessId, business.id), eq(schema.customers.phone, input.customer.phone))).limit(1);
    const customerId = (insertedCustomer ?? existingCustomer).id;
    const expiresAt = service.depositCents > 0 ? new Date(Math.min(now.getTime() + 900000, slot.startsAt.getTime())) : null;
    const [booking] = await transaction.insert(schema.bookings).values({ businessId: business.id, serviceId: service.id, customerId, requestKey, requestHash, ...slot,
      priceCents: service.priceCents, depositCents: service.depositCents, status: expiresAt ? "pending_payment" : "confirmed", expiresAt, createdAt: now }).returning();
    const token = accessToken(business.id, booking.id);
    await transaction.update(schema.bookings).set({ accessTokenHash: hash(token) }).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, booking.id)));
    if (expiresAt) {
      const paymentProvider = provider ?? getPaymentProvider();
      let charge;
      try {
        charge = pixChargeSchema.parse(await paymentProvider.createPixCharge({ idempotencyKey: chargeIdempotencyKey(business.id, requestKey), amountCents: service.depositCents, expiresAt }));
        if (charge.amountCents !== service.depositCents || charge.expiresAt.getTime() !== expiresAt.getTime()) throw new Error("Cobrança divergente.");
      } catch { throw new HttpError(503, "payment_unavailable", "Não foi possível criar a cobrança. Tente novamente com a mesma chave."); }
      await transaction.insert(schema.payments).values({ businessId: business.id, bookingId: booking.id, provider: paymentProvider.name, externalId: charge.externalId, idempotencyKey: chargeIdempotencyKey(business.id, requestKey),
        amountCents: charge.amountCents, expiresAt: charge.expiresAt, qrCodeDataUrl: charge.qrCodeDataUrl, copyPaste: charge.copyPaste });
    }
    return { replayed: false, data: { ...await bookingView(booking, transaction, now), accessToken: token } };
  });
}

export async function getBookingPayment(slug: string, id: string, authorization: string | null, database: Database = getDb()) {
  const bookingId = z.uuid().parse(id);
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization ?? "")?.[1];
  const business = await businessBySlug(slug, database);
  return database.transaction(async (transaction) => {
    await lockBusiness(transaction, business.id);
    const [booking] = await transaction.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, bookingId))).limit(1);
    if (!booking || !token || !booking.accessTokenHash || !/^[a-f0-9]{64}$/.test(booking.accessTokenHash)
      || !timingSafeEqual(Buffer.from(hash(token), "hex"), Buffer.from(booking.accessTokenHash, "hex"))) {
      throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
    }
    const now = new Date();
    await expirePending(transaction, business.id, now);
    const [current] = await transaction.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, bookingId))).limit(1);
    return bookingView(current, transaction, now);
  });
}
