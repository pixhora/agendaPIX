import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { bookingAccessSecret } from "../env";
import { HttpError } from "../http";
import { paymentsConfig } from "../payments/config";
import { assertMpConnectedForDeposit, getServiceBlockedReason, readMpDepositGate } from "../mercadopago-oauth/bookability";
import { createDrizzleMpStore } from "../mercadopago-oauth/repository";
import { getPaymentProvider } from "../payments";
import { MpAccountNotConnectedError } from "../payments/seller-account";
import { pixChargeSchema, type PaymentProvider, type PixCharge } from "../payments/provider";
import { callProvider, ProviderTimeoutError } from "../payments/timeout";
import { loadBookingAccess } from "../billing/load";
import { depositPolicySchema, POLICY_CHANGED_CODE, POLICY_CHANGED_MESSAGE } from "../policy/schema";
import { policyHashFor } from "../policy/hash";
import { clientPolicyText, policySummary, refundWindowClosedAtBooking } from "../policy/text";
import { availableSlots, localDate } from "./availability";
import { assertDepositBookable, serviceListingBookability } from "./deposit-bookability";
import { SlugMoved, readAliasTarget } from "../business-profile/public-slug";
import { availabilitySchema, bookingInputSchema, requestKeySchema, slugSchema } from "./validation";
import { depositSlotAllowed } from "./hold";
import { bookingConfig, type BookingConfig } from "./config";
import { getPublicBookingFacts, payerCpfRequired } from "../marketing/facts";
import { withDerivedExpiry } from "./payment-status";
import { consumeBookingRateLimit, consumePaymentPollRateLimit, tenantScopedHash } from "./rate-limit";
import { refreshPaidFromGateway, shouldPollGateway } from "../payments/status-poll";

type Database = NodePgDatabase<typeof schema>;
type BookingRequest = {
  serviceId: string;
  startsAt: string;
  customer: { name: string; phone: string; cpfCnpj?: string };
  policyHash?: string;
};

export function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

/** Digest novo: o CPF fica de fora para não ser recuperável por força bruta do sha256 sem sal. */
export function bookingRequestDigest(input: BookingRequest) {
  const { cpfCnpj: _cpf, ...customer } = input.customer;
  void _cpf;
  return hash(JSON.stringify({ ...input, customer }));
}

/** Digest antigo, com o JSON inteiro. Só serve para reconhecer reserva já gravada. */
export function legacyBookingRequestDigest(input: BookingRequest) {
  return hash(JSON.stringify(input));
}

/**
 * Replay da mesma requestKey aceita o digest novo ou o antigo.
 * Reserva antiga foi gravada com o JSON inteiro; o mesmo corpo, inclusive o CPF, continua batendo.
 * Um retry que tire o CPF de uma reserva antiga não reconstrói aquele digest e responde conflito.
 */
export function bookingRequestMatches(stored: string | null, input: BookingRequest) {
  if (!stored) return false;
  return stored === bookingRequestDigest(input) || stored === legacyBookingRequestDigest(input);
}
export function chargeIdempotencyKey(businessId: string, requestKey: string) {
  const bytes = Buffer.from(hash(`pix-charge:v1:${businessId}:${requestKey}`).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
function accessToken(businessId: string, bookingId: string) {
  const secret = bookingAccessSecret();
  if (!secret) throw new HttpError(503, "booking_unavailable", "Agendamento indisponível. Tente novamente mais tarde.");
  return createHmac("sha256", secret).update(`booking-access:v1:${businessId}:${bookingId}`).digest("base64url");
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
  const parsed = slugSchema.parse(slug);
  const [business] = await database.select().from(schema.businesses).where(eq(schema.businesses.slug, parsed)).limit(1);
  if (business) return business;
  // Slug sumido: lê o alias no banco, sem o cache de 60s.
  const moved = await readAliasTarget(parsed, database);
  if (moved) throw new SlugMoved(moved);
  throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
}
async function serviceById(businessId: string, serviceId: string, database: Database) {
  const [service] = await database.select().from(schema.services).where(and(eq(schema.services.businessId, businessId), eq(schema.services.id, serviceId), eq(schema.services.active, true))).limit(1);
  if (!service) throw new HttpError(404, "service_not_found", "Serviço não encontrado.");
  return service;
}
const BOOKINGS_PAUSED_MESSAGE = "Este estabelecimento não está aceitando novos agendamentos no momento.";

function publicPolicy(service: { depositCents: number; depositPolicy: unknown }, businessName: string) {
  if (service.depositCents <= 0) return { depositPolicy: null, policySummary: null, policyHash: null };
  const policy = depositPolicySchema.parse(service.depositPolicy);
  return {
    depositPolicy: policy,
    policySummary: policySummary(policy, { depositCents: service.depositCents, businessName }),
    policyHash: policyHashFor(policy, { depositCents: service.depositCents }),
  };
}

function deadlineAt(startsAt: Date, hours: number | null) {
  return hours === null ? null : new Date(startsAt.getTime() - hours * 3_600_000);
}

export async function listPublicServices(slug: string, database: Database = getDb()) {
  const business = await businessBySlug(slug, database);
  const access = await loadBookingAccess(business, database);
  const facts = await getPublicBookingFacts(business.id);
  const mpGate = await readMpDepositGate(business.id, { store: createDrizzleMpStore(database) });
  const rows = await database.select({
    id: schema.services.id,
    name: schema.services.name,
    durationMinutes: schema.services.durationMinutes,
    priceCents: schema.services.priceCents,
    depositCents: schema.services.depositCents,
    depositPolicy: schema.services.depositPolicy,
  }).from(schema.services).where(and(eq(schema.services.businessId, business.id), eq(schema.services.active, true)));
  return {
    name: business.name,
    timezone: business.timezone,
    address: null,
    phone: null,
    logoUrl: business.logoUrl,
    contactWhatsapp: business.contactWhatsapp,
    bookingsPaused: access.bookingsPaused,
    requiresPayerCpf: facts.requiresPayerCpf,
    pixRecipientDisplayName: facts.pixRecipientDisplayName,
    services: rows.map((service) => {
      const listing = serviceListingBookability(business, service, access);
      const mpReason = listing.blockedReason === "bookings_paused" ? null : getServiceBlockedReason(service, mpGate);
      const bookability = mpReason ? { bookable: false, blockedReason: mpReason } : listing;
      return {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        depositCents: service.depositCents,
        ...publicPolicy(service, business.name),
        ...bookability,
      };
    }),
  };
}
async function slotsFor(business: typeof schema.businesses.$inferSelect, service: typeof schema.services.$inferSelect, date: string, now: Date, database: Database) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [hours] = await database.select().from(schema.businessHours).where(and(eq(schema.businessHours.businessId, business.id), eq(schema.businessHours.weekday, weekday))).limit(1);
  const day = Date.parse(`${date}T00:00:00Z`);
  const busy = await database.select({ startsAt: schema.bookings.startsAt, endsAt: schema.bookings.endsAt }).from(schema.bookings).where(and(
    eq(schema.bookings.businessId, business.id), lt(schema.bookings.startsAt, new Date(day + 172800000)), gt(schema.bookings.endsAt, new Date(day - 86400000)),
    or(inArray(schema.bookings.status, ["confirmed", "completed"]), and(eq(schema.bookings.status, "pending_payment"), gt(schema.bookings.expiresAt, now))),
  ));
  const slots = availableSlots({ date, timezone: business.timezone, durationMinutes: service.durationMinutes, hours: hours ?? null, busy, now });
  if (service.depositCents <= 0) return slots;
  const holdMinutes = bookingConfig().BOOKING_HOLD_MINUTES;
  return slots.filter((slot) => depositSlotAllowed(slot.startsAt, now, holdMinutes));
}
export async function getAvailability(slug: string, query: unknown, database: Database = getDb()) {
  const input = availabilitySchema.parse(query);
  const business = await businessBySlug(slug, database);
  const access = await loadBookingAccess(business, database);
  if (access.bookingsPaused) return { timezone: business.timezone, slots: [], bookingsPaused: true as const };
  const service = await serviceById(business.id, input.serviceId, database);
  return { timezone: business.timezone, slots: await slotsFor(business, service, input.date, new Date(), database), bookingsPaused: false as const };
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
    expiresAt: charge.expiresAt,
  }).where(and(eq(schema.payments.businessId, payment.businessId), eq(schema.payments.id, payment.id), eq(schema.payments.status, "creating"))).returning();
  if (!updated) return null;
  // Reserva e Pix vencem no mesmo instante devolvido pelo gateway (ou no prazo único, se ele não devolver data).
  await database.update(schema.bookings).set({ expiresAt: charge.expiresAt }).where(and(
    eq(schema.bookings.businessId, payment.businessId),
    eq(schema.bookings.id, payment.bookingId),
    eq(schema.bookings.status, "pending_payment"),
  ));
  return updated;
}

async function createChargeOutsideTx(
  payment: typeof schema.payments.$inferSelect,
  provider: PaymentProvider,
  customer?: { name: string; phone: string; cpfCnpj?: string },
) {
  const timeoutMs = paymentsConfig().PAYMENT_PROVIDER_TIMEOUT_MS;
  try {
    return pixChargeSchema.parse(await callProvider(timeoutMs, (signal) => provider.createPixCharge({
      idempotencyKey: payment.idempotencyKey, reference: payment.id, amountCents: payment.amountCents, expiresAt: payment.expiresAt,
      customer,
    }, { signal, businessId: payment.businessId })));
  } catch (error) {
    if (error instanceof MpAccountNotConnectedError) {
      throw new HttpError(409, "mp_account_not_connected", "Conecte o Mercado Pago ao AgendaPix para cobrar o sinal.");
    }
    if (error instanceof ProviderTimeoutError) throw new HttpError(503, "payment_unavailable", "Não foi possível criar a cobrança. Tente novamente com a mesma chave.");
    throw new HttpError(503, "payment_unavailable", "Não foi possível criar a cobrança. Tente novamente com a mesma chave.");
  }
}

async function finalizeCreatingPayment(
  database: Database,
  payment: typeof schema.payments.$inferSelect,
  provider: PaymentProvider,
  customer?: { name: string; phone: string; cpfCnpj?: string },
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
  const policy = booking.policyText
    ? {
        text: booking.policyText,
        snapshot: booking.policySnapshot,
        refundDeadlineAt: booking.refundDeadlineAt,
        rescheduleDeadlineAt: booking.rescheduleDeadlineAt,
        refundWindowClosedAtBooking: Boolean(booking.policySnapshot && refundWindowClosedAtBooking(booking.policySnapshot, booking.startsAt, booking.createdAt)),
      }
    : null;
  return { bookingId: booking.id, status: booking.status, startsAt: booking.startsAt, endsAt: booking.endsAt, expiresAt: booking.expiresAt, payment: paymentView(payment, now), policy };
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
  const requestHash = bookingRequestDigest(input);
  const business = await businessBySlug(slug, database);
  const [prior] = await database.select({ id: schema.bookings.id }).from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.requestKey, requestKey))).limit(1);
  if (!prior) {
    const access = await loadBookingAccess(business, database);
    if (access.bookingsPaused) throw new HttpError(403, "bookings_paused", BOOKINGS_PAUSED_MESSAGE);
  }
  await consumeBookingRateLimit(database, business.id, clientIdentity, config);
  const clientHash = clientIdentity ? tenantScopedHash("booking-client:v1", business.id, clientIdentity) : null;
  const paymentProvider = provider ?? (undefined as PaymentProvider | undefined);
  const chargeCustomer = {
    name: input.customer.name,
    phone: input.customer.phone,
    ...(payerCpfRequired() && input.customer.cpfCnpj ? { cpfCnpj: input.customer.cpfCnpj } : {}),
  };

  // Transação curta com lock: reserva o horário e, se houver sinal, cria pagamento em "creating" sem chamar o gateway.
  const reserved = await database.transaction(async (transaction) => {
    await lockBusiness(transaction, business.id);
    const now = new Date();
    await expirePending(transaction, business.id, now);
    const [existing] = await transaction.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.requestKey, requestKey))).limit(1);
    if (existing) {
      if (!bookingRequestMatches(existing.requestHash, input)) throw new HttpError(409, "idempotency_conflict", "Essa chave já foi usada em outro agendamento.");
      const [payment] = await transaction.select().from(schema.payments).where(and(eq(schema.payments.businessId, business.id), eq(schema.payments.bookingId, existing.id))).limit(1);
      return { kind: "existing" as const, booking: existing, payment, token: accessToken(business.id, existing.id), now };
    }
    const access = await loadBookingAccess(business, transaction);
    if (access.bookingsPaused) throw new HttpError(403, "bookings_paused", BOOKINGS_PAUSED_MESSAGE);
    const service = await serviceById(business.id, input.serviceId, transaction);
    if (service.depositCents > 0) {
      assertDepositBookable(business);
      await assertMpConnectedForDeposit(business.id, { store: createDrizzleMpStore(database) });
      if ((await getPublicBookingFacts()).requiresPayerCpf && !input.customer.cpfCnpj) {
        throw new HttpError(400, "payer_cpf_required", "Informe o CPF para gerar o Pix.");
      }
    }
    const policy = service.depositCents > 0 ? depositPolicySchema.parse(service.depositPolicy) : null;
    const currentHash = policy ? policyHashFor(policy, { depositCents: service.depositCents }) : null;
    if (service.depositCents > 0 && !input.policyHash) throw new HttpError(400, "invalid_input", "Confira a política do sinal antes de agendar.");
    if (policy && currentHash && input.policyHash !== currentHash) {
      throw new HttpError(409, POLICY_CHANGED_CODE, POLICY_CHANGED_MESSAGE, undefined, {
        depositPolicy: policy,
        policySummary: policySummary(policy, { depositCents: service.depositCents, businessName: business.name }),
        policyHash: currentHash,
      });
    }
    const date = localDate(new Date(input.startsAt), business.timezone);
    const slots = await slotsFor(business, service, date, now, transaction);
    const slot = slots.find((candidate) => candidate.startsAt.toISOString() === input.startsAt);
    if (!slot) throw new HttpError(409, "slot_unavailable", "Esse horário não está disponível. Escolha outro.");
    if (service.depositCents > 0) await enforcePendingHoldLimits(transaction, business.id, { clientHash, phone: input.customer.phone }, now, config);
    const { cpfCnpj: _cpf, ...customerRow } = input.customer;
    void _cpf; // CPF não entra no cadastro nem no request_hash. O Mercado Pago só recebe o documento com MP_REQUIRES_PAYER_CPF=true.
    const [insertedCustomer] = await transaction.insert(schema.customers).values({ businessId: business.id, ...customerRow }).onConflictDoNothing({ target: [schema.customers.businessId, schema.customers.phone] }).returning({ id: schema.customers.id });
    const [existingCustomer] = insertedCustomer ? [] : await transaction.select({ id: schema.customers.id }).from(schema.customers).where(and(eq(schema.customers.businessId, business.id), eq(schema.customers.phone, input.customer.phone))).limit(1);
    const customerId = (insertedCustomer ?? existingCustomer).id;
    const holdMs = config.BOOKING_HOLD_MINUTES * 60_000;
    const expiresAt = service.depositCents > 0 ? new Date(now.getTime() + holdMs) : null;
    if (expiresAt && !depositSlotAllowed(slot.startsAt, now, config.BOOKING_HOLD_MINUTES)) {
      throw new HttpError(409, "slot_unavailable", "Esse horário não está disponível. Escolha outro.");
    }
    const [booking] = await transaction.insert(schema.bookings).values({ businessId: business.id, serviceId: service.id, customerId, requestKey, requestHash, clientHash, ...slot,
      priceCents: service.priceCents, depositCents: service.depositCents, status: expiresAt ? "pending_payment" : "confirmed", expiresAt, createdAt: now,
      policySnapshot: policy, policyText: policy ? clientPolicyText(policy, { businessName: business.name, depositCents: service.depositCents, contactWhatsapp: business.contactWhatsapp, startsAt: slot.startsAt, bookedAt: now, timezone: business.timezone }) : null, policyHash: currentHash,
      refundDeadlineAt: policy ? deadlineAt(slot.startsAt, policy.refundUntilHours) : null,
      rescheduleDeadlineAt: policy ? deadlineAt(slot.startsAt, policy.rescheduleUntilHours) : null,
    }).returning();
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
    return { kind: "created" as const, booking, payment, token, now, providerName: expiresAt ? (paymentProvider ?? getPaymentProvider()).name : null };
  });

  // Fora de qualquer transação: cobra o gateway. O horário já está preso pela exclusão gist.
  if (reserved.payment?.status === "creating") {
    const activeProvider = paymentProvider ?? getPaymentProvider();
    await finalizeCreatingPayment(database, reserved.payment, activeProvider, chargeCustomer);
  }

  const now = new Date();
  const [booking] = await database.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, reserved.booking.id))).limit(1);
  return { replayed: reserved.kind === "existing", data: { ...await bookingView(booking, database, now), accessToken: reserved.token } };
}

const PAYMENT_BEARER = /^Bearer ([A-Za-z0-9_-]{43})$/;

function bearerToken(authorization: string | null) {
  return PAYMENT_BEARER.exec(authorization ?? "")?.[1] ?? null;
}

function tokenMatches(token: string, accessTokenHash: string | null) {
  return Boolean(accessTokenHash && /^[a-f0-9]{64}$/.test(accessTokenHash)
    && timingSafeEqual(Buffer.from(hash(token), "hex"), Buffer.from(accessTokenHash, "hex")));
}

export type PaymentGatewayPoll = {
  provider?: PaymentProvider;
  timeoutMs?: number;
};

/**
 * Consulta pública do Pix. O caminho comum é somente leitura: sem transação, sem lock do negócio
 * e sem `expirePending`. O vencido da resposta sai de `expiresAt <= now`.
 * Com cobrança `pending` e hold vigente ou recém-vencido, no máximo uma consulta ao gateway a cada 20 s
 * (contador no banco). A chamada fica fora de transação. Pago segue `applyPaidEvent`, como o webhook.
 * Timeout ou erro do gateway devolve o estado local, sem 5xx.
 */
export async function getBookingPayment(
  slug: string,
  id: string,
  authorization: string | null,
  database: Database = getDb(),
  identity: string | null = null,
  config: BookingConfig = bookingConfig(),
  gateway?: PaymentGatewayPoll,
) {
  const bookingId = z.uuid().parse(id);
  slugSchema.parse(slug);
  const token = bearerToken(authorization);
  if (!token) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  const business = await businessBySlug(slug, database);
  await consumePaymentPollRateLimit(database, business.id, identity, config);
  const [booking] = await database.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, bookingId))).limit(1);
  if (!booking || !tokenMatches(token, booking.accessTokenHash)) {
    throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  }
  const now = new Date();
  const view = await bookingView(booking, database, now);
  if (!shouldPollGateway(view.payment, now)) return withDerivedExpiry(view, now);
  let provider = gateway?.provider;
  if (!provider) {
    try { provider = getPaymentProvider(); }
    catch { return withDerivedExpiry(view, now); }
  }
  const payment = view.payment;
  if (!payment?.externalId || provider.name !== payment.provider) return withDerivedExpiry(view, now);
  let timeoutMs = gateway?.timeoutMs;
  if (timeoutMs == null) {
    try { timeoutMs = paymentsConfig().PAYMENT_PROVIDER_TIMEOUT_MS; }
    catch { return withDerivedExpiry(view, now); }
  }
  let applied = false;
  try {
    applied = await refreshPaidFromGateway({
      database, businessId: booking.businessId, paymentId: payment.id, externalId: payment.externalId,
      provider, timeoutMs, now,
    });
  } catch {
    return withDerivedExpiry(view, now);
  }
  if (!applied) return withDerivedExpiry(view, now);
  const [fresh] = await database.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, booking.businessId), eq(schema.bookings.id, booking.id))).limit(1);
  const readAt = new Date();
  return withDerivedExpiry(await bookingView(fresh ?? booking, database, readAt), readAt);
}
