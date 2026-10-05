import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { authEnvSchema } from "../env";
import { HttpError } from "../http";
import { paymentsConfig } from "../payments/config";
import { getPaymentProvider } from "../payments";
import { pixChargeSchema, type PaymentProvider, type PixCharge } from "../payments/provider";
import { callProvider, ProviderTimeoutError } from "../payments/timeout";
import { availableSlots, localDate } from "./availability";
import { availabilitySchema, bookingInputSchema, requestKeySchema, slugSchema } from "./validation";
import { bookingConfig, type BookingConfig } from "./config";
import { consumeBookingRateLimit, tenantScopedHash } from "./rate-limit";

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
  await database.update(schema.payments).set({ status: "expired" }).where(and(
    eq(schema.payments.businessId, businessId),
    inArray(schema.payments.status, ["creating", "pending"]),
    lte(schema.payments.expiresAt, now),
  ));
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

/** Anexa QR/externalId somente se o pagamento ainda está em creating (evita corrida com reconciliação/expiração). */
export async function attachCreatedCharge(database: Database, payment: typeof schema.payments.$inferSelect, charge: PixCharge) {
  if (charge.amountCents !== payment.amountCents) throw new Error("Cobrança divergente.");
  const [updated] = await database.update(schema.payments).set({
    status: "pending", externalId: charge.externalId, qrCodeDataUrl: charge.qrCodeDataUrl, copyPaste: charge.copyPaste,
    // Mantém o vencimento da reserva (não o do gateway, que pode ser mais longo).
    expiresAt: payment.expiresAt,
  }).where(and(eq(schema.payments.businessId, payment.businessId), eq(schema.payments.id, payment.id), eq(schema.payments.status, "creating"))).returning();
  return updated ?? null;
}

async function createChargeOutsideTx(
  payment: typeof schema.payments.$inferSelect,
  provider: PaymentProvider,
  customer?: { name: string; phone: string; cpfCnpj: string },
) {
  const timeoutMs = paymentsConfig().PAYMENT_PROVIDER_TIMEOUT_MS;
  try {
    return pixChargeSchema.parse(await callProvider(timeoutMs, (signal) => provider.createPixCharge({
      idempotencyKey: payment.idempotencyKey, reference: payment.id, amountCents: payment.amountCents, expiresAt: payment.expiresAt,
      customer,
    }, { signal })));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof ProviderTimeoutError) throw new HttpError(503, "payment_unavailable", "Não foi possível criar a cobrança. Tente novamente com a mesma chave.");
    throw new HttpError(503, "payment_unavailable", "Não foi possível criar a cobrança. Tente novamente com a mesma chave.");
  }
}

async function finalizeCreatingPayment(
  database: Database,
  payment: typeof schema.payments.$inferSelect,
  provider: PaymentProvider,
  customer?: { name: string; phone: string; cpfCnpj: string },
) {
  const charge = await createChargeOutsideTx(payment, provider, customer);
  // Transação curta, sem lock do negócio: só anexa se ainda creating.
  const attached = await database.transaction(async (transaction) => attachCreatedCharge(transaction, payment, charge));
  if (!attached) {
    // Outro processo anexou, expirou ou reconciliou. Recarrega.
    const [current] = await database.select().from(schema.payments).where(and(eq(schema.payments.businessId, payment.businessId), eq(schema.payments.id, payment.id))).limit(1);
    if (!current || current.status === "creating") throw new HttpError(503, "payment_unavailable", "Não foi possível criar a cobrança. Tente novamente com a mesma chave.");
    return current;
  }
  return attached;
}
async function bookingView(booking: typeof schema.bookings.$inferSelect, database: Database, now: Date) {
  const [payment] = await database.select().from(schema.payments).where(and(eq(schema.payments.businessId, booking.businessId), eq(schema.payments.bookingId, booking.id))).limit(1);
  return { bookingId: booking.id, status: booking.status, startsAt: booking.startsAt, endsAt: booking.endsAt, expiresAt: booking.expiresAt, payment: paymentView(payment, now) };
}

function retryAfter(next: string | Date | null, now: Date) {
  return next ? Math.max(1, Math.ceil((new Date(next).getTime() - now.getTime()) / 1000)) : 60;
}

/**
 * Limita reservas pendentes (não pagas e não vencidas) para que ninguém bloqueie a agenda com sinais não pagos.
 * Executa sob o lock do negócio e depois de expirePending, então a contagem é exata e livre de corrida.
 */
async function enforcePendingHoldLimits(database: Database, businessId: string, holder: { clientHash: string | null; phone: string }, now: Date, config: BookingConfig) {
  const pending = and(eq(schema.bookings.businessId, businessId), eq(schema.bookings.status, "pending_payment"), gt(schema.bookings.expiresAt, now));
  const stats = { count: sql<number>`count(*)::int`, next: sql<string | null>`min(${schema.bookings.expiresAt})` };
  if (holder.clientHash) {
    const [client] = await database.select(stats).from(schema.bookings).where(and(pending, eq(schema.bookings.clientHash, holder.clientHash)));
    if (client.count >= config.BOOKING_MAX_PENDING_PER_CLIENT) {
      throw new HttpError(429, "pending_hold_limit", "Você já tem reservas aguardando pagamento. Pague ou aguarde o vencimento para reservar outro horário.", retryAfter(client.next, now));
    }
  }
  const [phone] = await database.select(stats).from(schema.bookings)
    .innerJoin(schema.customers, and(eq(schema.customers.businessId, schema.bookings.businessId), eq(schema.customers.id, schema.bookings.customerId)))
    .where(and(pending, eq(schema.customers.phone, holder.phone)));
  if (phone.count >= config.BOOKING_MAX_PENDING_PER_PHONE) {
    throw new HttpError(429, "pending_hold_limit", "Este telefone já tem reservas aguardando pagamento. Pague ou aguarde o vencimento para reservar outro horário.", retryAfter(phone.next, now));
  }
  const [business] = await database.select(stats).from(schema.bookings).where(pending);
  if (business.count >= config.BOOKING_MAX_PENDING_PER_BUSINESS) {
    throw new HttpError(409, "hold_capacity_reached", "Muitas reservas aguardando pagamento neste momento. Tente novamente em alguns minutos.", retryAfter(business.next, now));
  }
}

export async function createBooking(slug: string, body: unknown, key: unknown, database: Database = getDb(), provider?: PaymentProvider, clientIdentity: string | null = null) {
  const config = bookingConfig();
  const input = bookingInputSchema.parse(body);
  const requestKey = requestKeySchema.parse(key);
  const requestHash = hash(JSON.stringify(input));
  const business = await businessBySlug(slug, database);
  await consumeBookingRateLimit(database, business.id, clientIdentity, config);
  const clientHash = clientIdentity ? tenantScopedHash("booking-client:v1", business.id, clientIdentity) : null;
  const paymentProvider = provider ?? (undefined as PaymentProvider | undefined);

  // Transação curta com lock: reserva o horário e, se houver sinal, cria pagamento em "creating" sem chamar o gateway.
  const reserved = await database.transaction(async (transaction) => {
    await lockBusiness(transaction, business.id);
    const now = new Date();
    await expirePending(transaction, business.id, now);
    const [existing] = await transaction.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.requestKey, requestKey))).limit(1);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new HttpError(409, "idempotency_conflict", "Essa chave já foi usada em outro agendamento.");
      const [payment] = await transaction.select().from(schema.payments).where(and(eq(schema.payments.businessId, business.id), eq(schema.payments.bookingId, existing.id))).limit(1);
      return { kind: "existing" as const, booking: existing, payment, token: accessToken(business.id, existing.id), now, chargeCustomer: null };
    }
    const service = await serviceById(business.id, input.serviceId, transaction);
    const date = localDate(new Date(input.startsAt), business.timezone);
    const slots = await slotsFor(business, service, date, now, transaction);
    const slot = slots.find((candidate) => candidate.startsAt.toISOString() === input.startsAt);
    if (!slot) throw new HttpError(409, "slot_unavailable", "Esse horário não está disponível. Escolha outro.");
    if (service.depositCents > 0) await enforcePendingHoldLimits(transaction, business.id, { clientHash, phone: input.customer.phone }, now, config);
    const { cpfCnpj, ...customerRow } = input.customer;
    const [insertedCustomer] = await transaction.insert(schema.customers).values({ businessId: business.id, ...customerRow }).onConflictDoNothing({ target: [schema.customers.businessId, schema.customers.phone] }).returning({ id: schema.customers.id });
    const [existingCustomer] = insertedCustomer ? [] : await transaction.select({ id: schema.customers.id }).from(schema.customers).where(and(eq(schema.customers.businessId, business.id), eq(schema.customers.phone, input.customer.phone))).limit(1);
    const customerId = (insertedCustomer ?? existingCustomer).id;
    const expiresAt = service.depositCents > 0 ? new Date(Math.min(now.getTime() + config.BOOKING_HOLD_MINUTES * 60000, slot.startsAt.getTime())) : null;
    const [booking] = await transaction.insert(schema.bookings).values({ businessId: business.id, serviceId: service.id, customerId, requestKey, requestHash, clientHash, ...slot,
      priceCents: service.priceCents, depositCents: service.depositCents, status: expiresAt ? "pending_payment" : "confirmed", expiresAt, createdAt: now }).returning();
    const token = accessToken(business.id, booking.id);
    await transaction.update(schema.bookings).set({ accessTokenHash: hash(token) }).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, booking.id)));
    let payment: typeof schema.payments.$inferSelect | undefined;
    if (expiresAt) {
      const activeProvider = paymentProvider ?? getPaymentProvider();
      [payment] = await transaction.insert(schema.payments).values({
        businessId: business.id, bookingId: booking.id, provider: activeProvider.name, idempotencyKey: chargeIdempotencyKey(business.id, requestKey),
        amountCents: service.depositCents, expiresAt, status: "creating",
      }).returning();
    }
    return {
      kind: "created" as const, booking, payment, token, now,
      providerName: expiresAt ? (paymentProvider ?? getPaymentProvider()).name : null,
      chargeCustomer: expiresAt ? { name: input.customer.name, phone: input.customer.phone, cpfCnpj } : null,
    };
  });

  // Fora de qualquer transação: cobra o gateway. O horário já está preso pela exclusão gist.
  if (reserved.payment?.status === "creating") {
    const activeProvider = paymentProvider ?? getPaymentProvider();
    await finalizeCreatingPayment(database, reserved.payment, activeProvider, reserved.chargeCustomer ?? undefined);
  }

  const now = new Date();
  const [booking] = await database.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, reserved.booking.id))).limit(1);
  return { replayed: reserved.kind === "existing", data: { ...await bookingView(booking, database, now), accessToken: reserved.token } };
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
