import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import {
  SLOT_LINK_IDEMPOTENCY_KEY_PATTERN,
  slotLinkCreateRequestSchema,
  slotLinkCreatedResponseSchema,
  slotLinkListQuerySchema,
  slotLinkListResponseSchema,
  slotLinkOpenResponseSchema,
  slotLinkOwnerSchema,
  slotLinkPayRequestSchema,
  slotLinkPayResponseSchema,
  slotLinkPreviewResponseSchema,
  type SlotLinkStatus,
} from "../contracts/slot-link";
import { consumeAbuseBucket } from "../abuse-rate-limit";
import { loadBookingAccess } from "../billing/load";
import { findOwnedBusiness } from "../tenancy";
import { bookingAccessMac, bookingAccessMacMatches } from "./access-mac";
import { HttpError } from "../http";
import { payerCpfRequired } from "../marketing/facts";
import { assertMpConnectedForDeposit } from "../mercadopago-oauth/bookability";
import { createDrizzleMpStore } from "../mercadopago-oauth/repository";
import { MP_ACCOUNT_NOT_CONNECTED } from "../mercadopago/contract";
import type { PaymentProvider } from "../payments/provider";
import { policyHashFor } from "../policy/hash";
import { depositPolicySchema } from "../policy/schema";
import { clientPolicyText } from "../policy/text";
import { localDate } from "./availability";
import { bookingConfig, type BookingConfig } from "./config";
import { consumeSlotLinkCreateRateLimit, consumeSlotLinkOpenRateLimit, consumeSlotLinkPayRateLimit } from "./rate-limit";
import { createBooking, expirePending, listBookableSlots } from "./service";
import { createSlotLinkPreviewId, createSlotLinkToken, isSlotLinkPreviewId, isSlotLinkToken, slotLinkTokenHash } from "./slot-link-token";

type Database = NodePgDatabase<typeof schema>;
type LinkRow = typeof schema.slotLinks.$inferSelect;
type ServiceRow = typeof schema.services.$inferSelect;
type BusinessRow = typeof schema.businesses.$inferSelect;

const LINK_INVALID_MESSAGE = "Este link não está mais disponível.";
const LINK_EXPIRED_MESSAGE = "Este link expirou.";
const LINK_USED_MESSAGE = "Este horário já foi confirmado.";
const LINK_IN_PROGRESS_MESSAGE = "Este horário já está em pagamento.";
const LINK_CANCELLED_MESSAGE = "Este link não está mais disponível.";
const LINK_REPLACED_MESSAGE = "Este link foi trocado. Peça outro ao negócio.";
const SLOT_TAKEN_MESSAGE = "Esse horário acabou de ser reservado.";
const SLOT_TAKEN_OWNER_MESSAGE = "Esse horário acabou de ser ocupado. Escolha outro.";
const MP_OWNER_MESSAGE = "Conecte o Mercado Pago para cobrar sinal.";
const MP_PUBLIC_MESSAGE = "Esta loja não está recebendo sinal agora.";
const BOOKINGS_PAUSED_MESSAGE = "Este estabelecimento não está aceitando novos agendamentos no momento.";
const GLOBAL_PROBE_BUCKET = "*global*";
/**
 * Sem IP o probe cai num balde só. O teto por cliente (10–60/min) nesse balde
 * deixaria um visitante travar todo mundo. O teto alto só corta flood.
 * Na Vercel o IP existe (`BOOKING_TRUST_PROXY`); este balde só vale fora dela.
 */
const ANONYMOUS_PROBE_LIMIT = 10_000;

export function slotLinkExpiresAt(now: Date, startsAt: Date, ttlMinutes: number) {
  return new Date(Math.min(now.getTime() + ttlMinutes * 60_000, startsAt.getTime()));
}

function localClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("hour")}:${read("minute")}`;
}

function iso(value: Date | string | null | undefined) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(500, "internal_error", "Não foi possível concluir. Tente novamente.");
  return date.toISOString();
}

function postgresCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if (error instanceof Error && error.cause) return postgresCode(error.cause);
  return undefined;
}

function invalidLink() {
  return new HttpError(404, "link_invalid", LINK_INVALID_MESSAGE);
}

export function slotLinkPayMessage(linkId: string, idempotencyKey: string) {
  return `slot-link-pay:v1:${linkId}:${idempotencyKey}`;
}

/** HMAC do Idempotency-Key com o segredo atual. A chave crua não fica no banco. */
export function slotLinkPayIdempotencyHash(linkId: string, idempotencyKey: string) {
  const digest = bookingAccessMac(slotLinkPayMessage(linkId, idempotencyKey), "hex");
  if (!digest) throw new HttpError(503, "booking_unavailable", "Agendamento indisponível. Tente novamente mais tarde.");
  return digest;
}

/** requestKey da reserva, derivado do HMAC. Não é sha256 do id do link. */
export function slotLinkRequestKey(payIdempotencyHash: string) {
  const bytes = Buffer.from(payIdempotencyHash.slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** O HMAC gravado vale se foi feito com o segredo atual ou com o anterior. */
function storedPayHashMatches(stored: string | null, message: string) {
  return Boolean(stored && bookingAccessMacMatches(stored, message, "hex"));
}

function claimIsFresh(payStartedAt: Date | null, now: Date, holdMinutes: number) {
  return Boolean(payStartedAt && payStartedAt.getTime() + holdMinutes * 60_000 >= now.getTime());
}

function isCancellable(link: LinkRow, now: Date, holdMinutes: number) {
  if (link.status === "paid" || link.status === "cancelled" || link.status === "replaced" || link.bookingId) return false;
  return !claimIsFresh(link.payStartedAt, now, holdMinutes);
}

function parseIdempotencyKey(value: string | null) {
  const key = value?.trim() ?? "";
  if (!SLOT_LINK_IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new HttpError(400, "invalid_input", "Confira os dados enviados.");
  }
  return key;
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}\n${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string) {
  let raw = "";
  try { raw = Buffer.from(cursor, "base64url").toString("utf8"); } catch { throw new HttpError(400, "invalid_input", "Confira os dados enviados."); }
  const split = raw.indexOf("\n");
  const created = split >= 0 ? raw.slice(0, split) : "";
  const id = split >= 0 ? raw.slice(split + 1) : "";
  if (!z.iso.datetime({ offset: true }).safeParse(created).success || !z.uuid().safeParse(id).success) {
    throw new HttpError(400, "invalid_input", "Confira os dados enviados.");
  }
  return { createdAt: new Date(created), id };
}

async function requireOwned(businessId: string, ownerId: string, database: Database) {
  let business: BusinessRow | null;
  try {
    business = await findOwnedBusiness(businessId, ownerId, database);
  } catch (error) {
    if (error instanceof z.ZodError) throw new HttpError(404, "business_unavailable", "Negócio não encontrado.");
    throw error;
  }
  if (!business) throw new HttpError(404, "business_unavailable", "Negócio não encontrado.");
  return business;
}

async function serviceForBusiness(database: Database, businessId: string, serviceId: string, activeOnly: boolean) {
  const filters = [eq(schema.services.businessId, businessId), eq(schema.services.id, serviceId)];
  if (activeOnly) filters.push(eq(schema.services.active, true));
  const [service] = await database.select().from(schema.services).where(and(...filters)).limit(1);
  if (!service) throw new HttpError(404, "service_not_found", "Serviço não encontrado.");
  return service;
}

function presentService(service: ServiceRow) {
  return {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    priceCents: service.priceCents,
    depositCents: service.depositCents,
  };
}

function presentOwner(link: LinkRow, service: ServiceRow, now = new Date(), holdMinutes = bookingConfig().BOOKING_HOLD_MINUTES) {
  return slotLinkOwnerSchema.parse({
    id: link.id,
    service: presentService(service),
    startsAt: iso(link.startsAt),
    expiresAt: iso(link.expiresAt),
    status: link.status,
    createdAt: iso(link.createdAt),
    previewId: link.previewId,
    customerLabel: link.customerLabel,
    cancellable: isCancellable(link, now, holdMinutes),
  });
}

async function requireMercadoPago(businessId: string, database: Database, message: string) {
  try {
    await assertMpConnectedForDeposit(businessId, { store: createDrizzleMpStore(database) });
  } catch (error) {
    if (error instanceof HttpError && error.code === MP_ACCOUNT_NOT_CONNECTED) {
      throw new HttpError(409, "mp_not_connected", message);
    }
    throw error;
  }
}

async function overlappingBooking(database: Database, link: LinkRow, now: Date) {
  const ownKey = link.payIdempotencyHash ? slotLinkRequestKey(link.payIdempotencyHash) : null;
  const filters = [
    eq(schema.bookings.businessId, link.businessId),
    lt(schema.bookings.startsAt, link.endsAt),
    gt(schema.bookings.endsAt, link.startsAt),
    or(inArray(schema.bookings.status, ["confirmed", "completed"]), and(eq(schema.bookings.status, "pending_payment"), gt(schema.bookings.expiresAt, now))),
  ];
  if (ownKey) {
    const notOwn = or(isNull(schema.bookings.requestKey), ne(schema.bookings.requestKey, ownKey));
    if (notOwn) filters.push(notOwn);
  }
  if (link.bookingId) filters.push(ne(schema.bookings.id, link.bookingId));
  const [row] = await database.select({ id: schema.bookings.id }).from(schema.bookings).where(and(...filters)).limit(1);
  return row ?? null;
}

async function linkedBooking(database: Database, link: LinkRow) {
  if (!link.bookingId) return null;
  const [booking] = await database.select().from(schema.bookings).where(and(
    eq(schema.bookings.businessId, link.businessId),
    eq(schema.bookings.id, link.bookingId),
  )).limit(1);
  return booking ?? null;
}

async function confirmedSlotLinkBooking(database: Database, link: LinkRow) {
  const [row] = await database.select({ id: schema.bookings.id }).from(schema.slotLinkBookings).innerJoin(schema.bookings, and(
    eq(schema.bookings.businessId, schema.slotLinkBookings.businessId),
    eq(schema.bookings.id, schema.slotLinkBookings.bookingId),
  )).where(and(
    eq(schema.slotLinkBookings.businessId, link.businessId),
    eq(schema.slotLinkBookings.slotLinkId, link.id),
    inArray(schema.bookings.status, ["confirmed", "completed"]),
  )).limit(1);
  return row ?? null;
}

async function pointLinkAtPaidBooking(database: Database, link: LinkRow, bookingId: string, now: Date): Promise<SlotLinkStatus> {
  if (link.status === "cancelled" || link.status === "replaced") return link.status;
  await database.update(schema.slotLinks).set({ status: "paid", bookingId, updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    sql`${schema.slotLinks.status} NOT IN ('cancelled', 'replaced')`,
  ));
  return "paid";
}

async function writeStatus(database: Database, link: LinkRow, status: SlotLinkStatus, now: Date) {
  if (link.status === status || link.status === "cancelled" || link.status === "paid" || link.status === "replaced") return link.status;
  const [updated] = await database.update(schema.slotLinks).set({ status, updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    sql`${schema.slotLinks.status} NOT IN ('cancelled', 'paid', 'replaced')`,
  )).returning({ status: schema.slotLinks.status });
  return updated?.status ?? status;
}

function holdStillActive(booking: typeof schema.bookings.$inferSelect, now: Date) {
  return booking.status === "pending_payment" && Boolean(booking.expiresAt && booking.expiresAt > now);
}

/** Recalcula o status no banco. Pago e cancelado não voltam atrás. */
export async function refreshSlotLinkStatus(database: Database, link: LinkRow, now: Date): Promise<SlotLinkStatus> {
  if (link.status === "cancelled" || link.status === "replaced") return link.status;
  if (link.status === "paid") return "paid";
  const [booking, overlap, origin] = await Promise.all([
    linkedBooking(database, link),
    overlappingBooking(database, link, now),
    confirmedSlotLinkBooking(database, link),
  ]);
  // Reserva antiga reconfirmada (`late_rebooked`) marca o link, mesmo que `booking_id` já aponte para outra.
  if (origin) return pointLinkAtPaidBooking(database, link, origin.id, now);
  if (booking && (booking.status === "confirmed" || booking.status === "completed")) {
    return pointLinkAtPaidBooking(database, link, booking.id, now);
  }
  if (link.startsAt <= now) return writeStatus(database, link, "expired", now);
  if (overlap) return writeStatus(database, link, "taken", now);
  // Hold da reserva atual venceu e nenhuma reserva deste link confirmou: o link expira.
  // `late_no_slot` não marca pago. Claim novo ainda passa enquanto o prazo do link existir.
  if (booking && !holdStillActive(booking, now)) return writeStatus(database, link, "expired", now);
  if (link.expiresAt <= now) return writeStatus(database, link, "expired", now);
  return writeStatus(database, link, "pending", now);
}

export async function createSlotLink(businessId: string, ownerId: string, body: unknown, database: Database = getDb()) {
  const config = bookingConfig();
  const input = slotLinkCreateRequestSchema.parse(body);
  const business = await requireOwned(businessId, ownerId, database);
  await consumeSlotLinkCreateRateLimit(database, business.id, ownerId, config);
  const service = await serviceForBusiness(database, business.id, input.serviceId, true);
  if (service.depositCents <= 0) throw new HttpError(400, "invalid_input", "Esse serviço não cobra sinal.");
  await requireMercadoPago(business.id, database, MP_OWNER_MESSAGE);
  const access = await loadBookingAccess(business, database);
  if (access.bookingsPaused) throw new HttpError(403, "bookings_paused", BOOKINGS_PAUSED_MESSAGE);
  const now = new Date();
  const slots = await listBookableSlots(business, service, input.date, now, database);
  const matches = slots.filter((slot) => localClock(slot.startsAt, business.timezone) === input.time);
  if (matches.length !== 1) throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_OWNER_MESSAGE);
  const slot = matches[0];
  const expiresAt = slotLinkExpiresAt(now, slot.startsAt, config.SLOT_LINK_TTL_MINUTES);
  if (expiresAt.getTime() <= now.getTime() || expiresAt.getTime() > slot.startsAt.getTime()) {
    throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_OWNER_MESSAGE);
  }
  const token = createSlotLinkToken();
  const previewId = createSlotLinkPreviewId();
  const [link] = await database.insert(schema.slotLinks).values({
    businessId: business.id,
    serviceId: service.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    expiresAt,
    status: "pending",
    tokenHash: slotLinkTokenHash(token),
    previewId,
    customerLabel: input.customerLabel ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return slotLinkCreatedResponseSchema.parse({
    ...presentOwner(link, service),
    token,
    path: `/api/public/${business.slug}/slot-links/${token}`,
  });
}

function createdLinkResponse(link: LinkRow, service: ServiceRow, business: BusinessRow, token: string) {
  return slotLinkCreatedResponseSchema.parse({
    ...presentOwner(link, service),
    token,
    path: `/api/public/${business.slug}/slot-links/${token}`,
  });
}

/**
 * Troca um link pendente por outro do mesmo horário. Claim ativo não muda o link.
 * Horário ocupado também não. O token antigo passa a responder `link_replaced`.
 */
export async function reissueSlotLink(businessId: string, ownerId: string, linkId: string, database: Database = getDb()) {
  if (!z.uuid().safeParse(linkId).success) throw invalidLink();
  const config = bookingConfig();
  const business = await requireOwned(businessId, ownerId, database);
  await consumeSlotLinkCreateRateLimit(database, business.id, ownerId, config);
  await requireMercadoPago(business.id, database, MP_OWNER_MESSAGE);
  const access = await loadBookingAccess(business, database);
  if (access.bookingsPaused) throw new HttpError(403, "bookings_paused", BOOKINGS_PAUSED_MESSAGE);
  const issued = await database.transaction(async (tx) => {
    const [clock] = (await tx.execute(sql`SELECT now() AS now`)).rows as { now: Date | string }[];
    const now = new Date(clock?.now ?? Date.now());
    const [locked] = await tx.select().from(schema.slotLinks).where(and(
      eq(schema.slotLinks.businessId, business.id),
      eq(schema.slotLinks.id, linkId),
    )).for("update").limit(1);
    if (!locked) throw invalidLink();
    if (locked.status === "replaced") throw new HttpError(409, "link_replaced", LINK_REPLACED_MESSAGE);
    if (locked.status === "cancelled") throw new HttpError(409, "link_cancelled", LINK_CANCELLED_MESSAGE);
    if (locked.status === "expired") throw new HttpError(410, "link_expired", LINK_EXPIRED_MESSAGE);
    if (locked.status !== "pending") throw new HttpError(409, "link_used", LINK_USED_MESSAGE);
    const booking = locked.bookingId ? await tx.select().from(schema.bookings).where(and(
      eq(schema.bookings.businessId, locked.businessId),
      eq(schema.bookings.id, locked.bookingId),
    )).limit(1).then((rows) => rows[0] ?? null) : null;
    if ((booking && holdStillActive(booking, now)) || claimIsFresh(locked.payStartedAt, now, config.BOOKING_HOLD_MINUTES)) {
      throw new HttpError(409, "link_in_progress", LINK_IN_PROGRESS_MESSAGE);
    }
    const service = await serviceForBusiness(tx, business.id, locked.serviceId, true).catch((error) => {
      if (error instanceof HttpError && error.code === "service_not_found") return null;
      throw error;
    });
    if (!service || service.depositCents <= 0) throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_OWNER_MESSAGE);
    const slots = await listBookableSlots(business, service, localDate(locked.startsAt, business.timezone), now, tx);
    if (!slots.some((slot) => slot.startsAt.getTime() === locked.startsAt.getTime())) {
      throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_OWNER_MESSAGE);
    }
    const expiresAt = slotLinkExpiresAt(now, locked.startsAt, config.SLOT_LINK_TTL_MINUTES);
    if (expiresAt.getTime() <= now.getTime() || expiresAt.getTime() > locked.startsAt.getTime()) {
      throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_OWNER_MESSAGE);
    }
    const token = createSlotLinkToken();
    const previewId = createSlotLinkPreviewId();
    const [created] = await tx.insert(schema.slotLinks).values({
      businessId: business.id,
      serviceId: locked.serviceId,
      startsAt: locked.startsAt,
      endsAt: locked.endsAt,
      expiresAt,
      status: "pending",
      tokenHash: slotLinkTokenHash(token),
      previewId,
      customerLabel: locked.customerLabel,
      createdAt: now,
      updatedAt: now,
    }).returning();
    const [replaced] = await tx.update(schema.slotLinks).set({
      status: "replaced",
      replacedByLinkId: created.id,
      updatedAt: now,
    }).where(and(
      eq(schema.slotLinks.businessId, business.id),
      eq(schema.slotLinks.id, locked.id),
      eq(schema.slotLinks.status, "pending"),
    )).returning({ id: schema.slotLinks.id });
    if (!replaced) throw new HttpError(409, "link_in_progress", LINK_IN_PROGRESS_MESSAGE);
    return { created, service, token };
  });
  return createdLinkResponse(issued.created, issued.service, business, issued.token);
}

export async function listSlotLinks(businessId: string, ownerId: string, query: unknown, database: Database = getDb()) {
  const input = slotLinkListQuerySchema.parse(query);
  const business = await requireOwned(businessId, ownerId, database);
  const limit = input.limit ?? 20;
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const now = new Date();
  const filters = [
    eq(schema.slotLinks.businessId, business.id),
    sql`(${schema.slotLinks.startsAt} AT TIME ZONE ${business.timezone})::date = ${input.date}::date`,
  ];
  if (cursor) filters.push(sql`(${schema.slotLinks.createdAt}, ${schema.slotLinks.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`);
  const rows = await database.select().from(schema.slotLinks).where(and(...filters)).orderBy(desc(schema.slotLinks.createdAt), desc(schema.slotLinks.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const serviceIds = [...new Set(page.map((row) => row.serviceId))];
  const services = serviceIds.length === 0 ? [] : await database.select().from(schema.services).where(and(
    eq(schema.services.businessId, business.id),
    inArray(schema.services.id, serviceIds),
  ));
  const byId = new Map(services.map((service) => [service.id, service]));
  const links = await Promise.all(page.map(async (row) => {
    const status = await refreshSlotLinkStatus(database, row, now);
    const service = byId.get(row.serviceId);
    if (!service) throw new HttpError(500, "internal_error", "Não foi possível concluir. Tente novamente.");
    return presentOwner({ ...row, status }, service, now);
  }));
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null;
  return slotLinkListResponseSchema.parse({ links, nextCursor });
}

export async function cancelSlotLink(businessId: string, ownerId: string, linkId: string, database: Database = getDb()) {
  if (!z.uuid().safeParse(linkId).success) throw invalidLink();
  const business = await requireOwned(businessId, ownerId, database);
  const [link] = await database.select().from(schema.slotLinks).where(and(
    eq(schema.slotLinks.businessId, business.id),
    eq(schema.slotLinks.id, linkId),
  )).limit(1);
  if (!link) throw invalidLink();
  const [clock] = (await database.execute(sql`SELECT now() AS now`)).rows as { now: Date | string }[];
  const now = new Date(clock?.now ?? Date.now());
  const holdMinutes = bookingConfig().BOOKING_HOLD_MINUTES;
  const status = await refreshSlotLinkStatus(database, link, now);
  const current = { ...link, status };
  if (status === "cancelled") {
    const service = await serviceForBusiness(database, business.id, link.serviceId, false);
    return presentOwner(current, service, now, holdMinutes);
  }
  if (!isCancellable(current, now, holdMinutes)) throw new HttpError(409, "link_used", LINK_USED_MESSAGE);
  const service = await serviceForBusiness(database, business.id, link.serviceId, false);
  const [updated] = await database.update(schema.slotLinks).set({ status: "cancelled", updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, business.id),
    eq(schema.slotLinks.id, link.id),
    isNull(schema.slotLinks.bookingId),
    or(
      isNull(schema.slotLinks.payStartedAt),
      sql`${schema.slotLinks.payStartedAt} < now() - (${holdMinutes} * interval '1 minute')`,
    ),
    sql`${schema.slotLinks.status} <> 'paid'`,
  )).returning();
  if (!updated) throw new HttpError(409, "link_used", LINK_USED_MESSAGE);
  return presentOwner(updated, service, now, holdMinutes);
}

async function businessBySlug(database: Database, slug: string) {
  const parsed = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).safeParse(slug);
  if (!parsed.success) return null;
  const [business] = await database.select().from(schema.businesses).where(eq(schema.businesses.slug, parsed.data)).limit(1);
  return business ?? null;
}

async function linkByToken(database: Database, token: string) {
  const [link] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.tokenHash, slotLinkTokenHash(token))).limit(1);
  return link ?? null;
}

async function probeLimit(database: Database, scope: string, identity: string | null, limit: number) {
  if (!identity) {
    await consumeAbuseBucket(scope, GLOBAL_PROBE_BUCKET, ANONYMOUS_PROBE_LIMIT, "minute", database);
    return;
  }
  await consumeAbuseBucket(scope, identity, limit, "minute", database);
}

function policyView(service: ServiceRow, business: BusinessRow, startsAt: Date) {
  if (service.depositCents <= 0) return null;
  const policy = depositPolicySchema.parse(service.depositPolicy);
  const text = clientPolicyText(policy, {
    businessName: business.name,
    depositCents: service.depositCents,
    contactWhatsapp: business.contactWhatsapp,
    startsAt,
    timezone: business.timezone,
  });
  return { text, hash: policyHashFor(policy, { depositCents: service.depositCents }) };
}

export async function openSlotLink(slug: string, token: string, identity: string | null, database: Database = getDb(), config: BookingConfig = bookingConfig()) {
  if (!isSlotLinkToken(token)) throw invalidLink();
  await probeLimit(database, "slot-link-open-probe", identity, config.SLOT_LINK_OPEN_PER_CLIENT);
  const business = await businessBySlug(database, slug);
  const link = await linkByToken(database, token);
  if (!link || !business || business.id !== link.businessId || business.slug !== slug) throw invalidLink();
  await consumeSlotLinkOpenRateLimit(database, business.id, identity, config);
  const now = new Date();
  const status = await refreshSlotLinkStatus(database, link, now);
  if (status === "replaced" || link.status === "replaced") throw new HttpError(409, "link_replaced", LINK_REPLACED_MESSAGE);
  const service = await serviceForBusiness(database, business.id, link.serviceId, false);
  const policy = policyView(service, business, link.startsAt);
  return slotLinkOpenResponseSchema.parse({
    business: {
      name: business.name,
      slug: business.slug,
      logoUrl: business.logoUrl,
      contactWhatsapp: business.contactWhatsapp,
      publicPath: `/${business.slug}`,
    },
    service: presentService(service),
    startsAt: iso(link.startsAt),
    depositCents: service.depositCents,
    remainingCents: service.priceCents - service.depositCents,
    policy,
    expiresAt: iso(link.expiresAt),
    status,
    requiresPayerCpf: payerCpfRequired(),
  });
}

function payRefusal(link: LinkRow, status: SlotLinkStatus, now: Date) {
  if (status === "replaced" || link.status === "replaced") return new HttpError(409, "link_replaced", LINK_REPLACED_MESSAGE);
  if (status === "cancelled" || link.status === "cancelled") return new HttpError(409, "link_cancelled", LINK_CANCELLED_MESSAGE);
  if (status === "paid" || link.status === "paid") return new HttpError(409, "link_used", LINK_USED_MESSAGE);
  // `expiresAt` do link não bloqueia aqui: a mesma chave ainda retoma o Pix se o hold da reserva vale.
  if (link.startsAt <= now) return new HttpError(410, "link_expired", LINK_EXPIRED_MESSAGE);
  if (status === "taken") return new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
  return null;
}

/** Recria o vínculo se a reserva nasceu e o processo caiu antes de gravar `slot_link_bookings`. */
export async function ensureSlotLinkBooking(database: Database, businessId: string, bookingId: string) {
  const [have] = await database.select({ slotLinkId: schema.slotLinkBookings.slotLinkId }).from(schema.slotLinkBookings).where(and(
    eq(schema.slotLinkBookings.businessId, businessId),
    eq(schema.slotLinkBookings.bookingId, bookingId),
  )).limit(1);
  if (have) return have.slotLinkId;
  const [pointed] = await database.select({ id: schema.slotLinks.id, status: schema.slotLinks.status }).from(schema.slotLinks).where(and(
    eq(schema.slotLinks.businessId, businessId),
    eq(schema.slotLinks.bookingId, bookingId),
  )).limit(1);
  let slotLinkId = pointed && pointed.status !== "replaced" && pointed.status !== "cancelled" ? pointed.id : null;
  if (!slotLinkId) {
    const [booking] = await database.select({ requestKey: schema.bookings.requestKey }).from(schema.bookings).where(and(
      eq(schema.bookings.businessId, businessId),
      eq(schema.bookings.id, bookingId),
    )).limit(1);
    if (booking?.requestKey) {
      const candidates = await database.select({
        id: schema.slotLinks.id,
        status: schema.slotLinks.status,
        payIdempotencyHash: schema.slotLinks.payIdempotencyHash,
      }).from(schema.slotLinks).where(and(
        eq(schema.slotLinks.businessId, businessId),
        isNotNull(schema.slotLinks.payIdempotencyHash),
      ));
      slotLinkId = candidates.find((candidate) => (
        candidate.payIdempotencyHash
        && candidate.status !== "replaced"
        && candidate.status !== "cancelled"
        && slotLinkRequestKey(candidate.payIdempotencyHash) === booking.requestKey
      ))?.id ?? null;
    }
  }
  if (!slotLinkId) return null;
  await database.insert(schema.slotLinkBookings).values({ businessId, slotLinkId, bookingId }).onConflictDoNothing();
  await database.update(schema.slotLinks).set({ bookingId, updatedAt: new Date() }).where(and(
    eq(schema.slotLinks.businessId, businessId),
    eq(schema.slotLinks.id, slotLinkId),
    isNull(schema.slotLinks.bookingId),
    sql`${schema.slotLinks.status} NOT IN ('cancelled', 'replaced')`,
  ));
  return slotLinkId;
}

async function attachSlotLinkBooking(database: Database, link: LinkRow, hash: string, bookingId: string) {
  await database.insert(schema.slotLinkBookings).values({
    businessId: link.businessId,
    slotLinkId: link.id,
    bookingId,
  }).onConflictDoNothing();
  await database.update(schema.slotLinks).set({ bookingId, updatedAt: new Date() }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    eq(schema.slotLinks.payIdempotencyHash, hash),
  ));
}

async function releaseClaim(database: Database, link: LinkRow, hash: string) {
  await database.update(schema.slotLinks).set({ payStartedAt: null, payIdempotencyHash: null, updatedAt: new Date() }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    eq(schema.slotLinks.payIdempotencyHash, hash),
    isNull(schema.slotLinks.bookingId),
    eq(schema.slotLinks.status, "pending"),
  ));
}

async function markTaken(database: Database, link: LinkRow) {
  const now = new Date();
  await database.update(schema.slotLinks).set({
    status: "taken", payStartedAt: null, payIdempotencyHash: null, updatedAt: now,
  }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    sql`${schema.slotLinks.status} NOT IN ('cancelled', 'paid')`,
  ));
}

function bookingIsPaid(booking: typeof schema.bookings.$inferSelect | null, payment: typeof schema.payments.$inferSelect | null) {
  return booking?.status === "confirmed" || booking?.status === "completed" || payment?.status === "paid";
}

/**
 * Claim expirável. O UPDATE condicional é o portão: `booking_id` nulo e
 * `pay_started_at` nulo ou mais velho que o hold. Hold vencido com reserva
 * pendente passa antes por `expirePending` (o mesmo caminho do hold normal),
 * na mesma transação, e solta o `booking_id`. Não cancela o Pix no gateway:
 * a cobrança vencida segue o cancelamento da reconciliação (`cancelCharge`,
 * PUT /v1/payments/{id} com status cancelled) e, se o Pix entrar depois,
 * `resolveLatePayment`.
 */
async function claimForPay(database: Database, link: LinkRow, currentHash: string, message: string, holdMinutes: number) {
  return database.transaction(async (tx) => {
    const [clock] = (await tx.execute(sql`SELECT now() AS now`)).rows as { now: Date | string }[];
    const now = new Date(clock?.now ?? Date.now());
    const [locked] = await tx.select().from(schema.slotLinks).where(and(
      eq(schema.slotLinks.businessId, link.businessId),
      eq(schema.slotLinks.id, link.id),
    )).for("update").limit(1);
    if (!locked) throw invalidLink();
    if (locked.status === "replaced") throw new HttpError(409, "link_replaced", LINK_REPLACED_MESSAGE);
    if (locked.status === "cancelled") throw new HttpError(409, "link_cancelled", LINK_CANCELLED_MESSAGE);
    if (locked.status === "paid") throw new HttpError(409, "link_used", LINK_USED_MESSAGE);
    if (locked.status === "taken") throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
    if (locked.startsAt <= now) {
      await tx.update(schema.slotLinks).set({ status: "expired", updatedAt: now }).where(and(
        eq(schema.slotLinks.id, locked.id),
        sql`${schema.slotLinks.status} NOT IN ('cancelled', 'paid')`,
      ));
      throw new HttpError(410, "link_expired", LINK_EXPIRED_MESSAGE);
    }
    const booking = locked.bookingId ? await tx.select().from(schema.bookings).where(and(
      eq(schema.bookings.businessId, locked.businessId),
      eq(schema.bookings.id, locked.bookingId),
    )).for("update").limit(1).then((rows) => rows[0] ?? null) : null;
    const payment = booking ? await tx.select().from(schema.payments).where(and(
      eq(schema.payments.businessId, locked.businessId),
      eq(schema.payments.bookingId, booking.id),
    )).limit(1).then((rows) => rows[0] ?? null) : null;
    if (bookingIsPaid(booking, payment)) {
      await tx.update(schema.slotLinks).set({ status: "paid", updatedAt: now }).where(and(
        eq(schema.slotLinks.id, locked.id),
        sql`${schema.slotLinks.status} <> 'cancelled'`,
      ));
      throw new HttpError(409, "link_used", LINK_USED_MESSAGE);
    }
    const holdActive = Boolean(booking && booking.status === "pending_payment" && booking.expiresAt && booking.expiresAt > now);
    const claimActive = holdActive || claimIsFresh(locked.payStartedAt, now, holdMinutes);
    // A mesma chave retoma o Pix mesmo com o prazo do link vencido, se o hold da reserva ainda vale.
    // O hash gravado pode ser o do segredo anterior: a requestKey da reserva nasceu dele.
    if (claimActive && storedPayHashMatches(locked.payIdempotencyHash, message)) {
      return { mode: "resume" as const, now, hash: locked.payIdempotencyHash as string };
    }
    if (locked.expiresAt <= now) {
      await tx.update(schema.slotLinks).set({ status: "expired", updatedAt: now }).where(and(
        eq(schema.slotLinks.id, locked.id),
        sql`${schema.slotLinks.status} NOT IN ('cancelled', 'paid')`,
      ));
      throw new HttpError(410, "link_expired", LINK_EXPIRED_MESSAGE);
    }
    if (claimActive) throw new HttpError(409, "link_in_progress", LINK_IN_PROGRESS_MESSAGE);
    if (booking && booking.status === "pending_payment") {
      await expirePending(tx, locked.businessId, now);
    }
    if (booking) {
      await tx.update(schema.slotLinks).set({ bookingId: null, updatedAt: now }).where(and(
        eq(schema.slotLinks.businessId, locked.businessId),
        eq(schema.slotLinks.id, locked.id),
        eq(schema.slotLinks.bookingId, booking.id),
      ));
    }
    const [claimed] = await tx.update(schema.slotLinks).set({
      status: "pending",
      payStartedAt: now,
      payIdempotencyHash: currentHash,
      updatedAt: now,
    }).where(and(
      eq(schema.slotLinks.businessId, locked.businessId),
      eq(schema.slotLinks.id, locked.id),
      sql`${schema.slotLinks.status} IN ('pending', 'expired')`,
      isNull(schema.slotLinks.bookingId),
      or(
        isNull(schema.slotLinks.payStartedAt),
        sql`${schema.slotLinks.payStartedAt} < now() - (${holdMinutes} * interval '1 minute')`,
      ),
      gt(schema.slotLinks.expiresAt, now),
    )).returning({ id: schema.slotLinks.id });
    if (!claimed) throw new HttpError(409, "link_in_progress", LINK_IN_PROGRESS_MESSAGE);
    return { mode: "create" as const, now, hash: currentHash };
  });
}

function payJson(data: Awaited<ReturnType<typeof createBooking>>["data"]) {
  return slotLinkPayResponseSchema.parse({
    bookingId: data.bookingId,
    status: data.status,
    startsAt: iso(data.startsAt),
    endsAt: iso(data.endsAt),
    expiresAt: iso(data.expiresAt),
    accessToken: data.accessToken,
    payment: data.payment ? {
      id: data.payment.id,
      provider: data.payment.provider,
      externalId: data.payment.externalId,
      amountCents: data.payment.amountCents,
      status: data.payment.status,
      expiresAt: iso(data.payment.expiresAt),
      qrCodeDataUrl: data.payment.qrCodeDataUrl,
      copyPaste: data.payment.copyPaste,
    } : null,
    policy: data.policy ? {
      text: data.policy.text,
      snapshot: data.policy.snapshot,
      refundDeadlineAt: iso(data.policy.refundDeadlineAt),
      rescheduleDeadlineAt: iso(data.policy.rescheduleDeadlineAt),
      refundWindowClosedAtBooking: data.policy.refundWindowClosedAtBooking,
    } : null,
  });
}

export async function paySlotLink(
  slug: string,
  token: string,
  body: unknown,
  idempotencyKey: string | null,
  identity: string | null,
  database: Database = getDb(),
  provider?: PaymentProvider,
  config: BookingConfig = bookingConfig(),
) {
  if (!isSlotLinkToken(token)) throw invalidLink();
  await probeLimit(database, "slot-link-pay-probe", identity, config.SLOT_LINK_PAY_PER_CLIENT);
  const business = await businessBySlug(database, slug);
  const link = await linkByToken(database, token);
  if (!link || !business || business.id !== link.businessId || business.slug !== slug) throw invalidLink();
  await consumeAbuseBucket("slot-link-pay-token", link.tokenHash, config.SLOT_LINK_PAY_PER_TOKEN, "minute", database);
  const key = parseIdempotencyKey(idempotencyKey);
  const parsed = slotLinkPayRequestSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "invalid_input", "Confira os dados enviados.");
  const input = parsed.data;
  await consumeSlotLinkPayRateLimit(database, business.id, identity, config);
  const now = new Date();
  const status = await refreshSlotLinkStatus(database, link, now);
  const refusal = payRefusal({ ...link, status }, status, now);
  if (refusal) throw refusal;
  const service = await serviceForBusiness(database, business.id, link.serviceId, true);
  if (service.depositCents <= 0) throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
  await requireMercadoPago(business.id, database, MP_PUBLIC_MESSAGE);
  const message = slotLinkPayMessage(link.id, key);
  const currentHash = slotLinkPayIdempotencyHash(link.id, key);
  const claimed = await claimForPay(database, link, currentHash, message, config.BOOKING_HOLD_MINUTES);
  const hash = claimed.hash;
  const requestKey = slotLinkRequestKey(hash);
  try {
    if (claimed.mode === "create") {
      const date = localDate(link.startsAt, business.timezone);
      const slots = await listBookableSlots(business, service, date, claimed.now, database);
      if (!slots.some((slot) => slot.startsAt.getTime() === link.startsAt.getTime())) {
        await markTaken(database, link);
        throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
      }
    }
    const result = await createBooking(business.slug, {
      serviceId: service.id,
      startsAt: link.startsAt.toISOString(),
      customer: input.customer,
      policyHash: input.policyHash,
    }, requestKey, database, provider, identity, async (tx, bookingId) => {
      await attachSlotLinkBooking(tx, link, hash, bookingId);
    });
    return payJson(result.data);
  } catch (error) {
    if (postgresCode(error) === "23P01" || (error instanceof HttpError && error.code === "slot_unavailable")) {
      await markTaken(database, link);
      throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
    }
    if (error instanceof HttpError && error.code === MP_ACCOUNT_NOT_CONNECTED) {
      await releaseClaim(database, link, hash);
      throw new HttpError(409, "mp_not_connected", MP_PUBLIC_MESSAGE);
    }
    const [existing] = await database.select({ id: schema.bookings.id }).from(schema.bookings).where(and(
      eq(schema.bookings.businessId, link.businessId),
      eq(schema.bookings.requestKey, requestKey),
    )).limit(1);
    if (existing) {
      await attachSlotLinkBooking(database, link, hash, existing.id);
    } else if (claimed.mode === "create") {
      await releaseClaim(database, link, hash);
    }
    throw error;
  }
}

export async function readSlotLinkPreview(
  previewId: string,
  identity: string | null,
  database: Database = getDb(),
  config: BookingConfig = bookingConfig(),
  options?: { probe?: boolean },
) {
  if (!isSlotLinkPreviewId(previewId)) throw invalidLink();
  // A prévia da página (`generateMetadata`) só chama isto depois de achar o token
  // e não pode gastar o balde nesse caminho. A rota pública continua consumindo.
  if (options?.probe !== false) {
    await probeLimit(database, "slot-link-preview", identity, config.SLOT_LINK_OPEN_PER_CLIENT);
  }
  const [link] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.previewId, previewId)).limit(1);
  if (!link) throw invalidLink();
  const [business] = await database.select().from(schema.businesses).where(eq(schema.businesses.id, link.businessId)).limit(1);
  if (!business) throw invalidLink();
  const now = new Date();
  const status = await refreshSlotLinkStatus(database, link, now);
  if (status !== "pending") {
    return slotLinkPreviewResponseSchema.parse({
      kind: "generic",
      businessName: business.name,
      logoUrl: business.logoUrl,
    });
  }
  const [service] = await database.select().from(schema.services).where(and(
    eq(schema.services.businessId, link.businessId),
    eq(schema.services.id, link.serviceId),
  )).limit(1);
  if (!service) {
    return slotLinkPreviewResponseSchema.parse({
      kind: "generic",
      businessName: business.name,
      logoUrl: business.logoUrl,
    });
  }
  return slotLinkPreviewResponseSchema.parse({
    kind: "slot",
    businessName: business.name,
    logoUrl: business.logoUrl,
    serviceName: service.name,
    date: localDate(link.startsAt, business.timezone),
    time: localClock(link.startsAt, business.timezone),
  });
}

/** Apaga o lembrete do dono depois que o horário começou. A linha do link fica. */
export async function purgeExpiredSlotLinkLabels(database: Database = getDb(), now = new Date()) {
  const rows = await database.update(schema.slotLinks).set({ customerLabel: null, updatedAt: now }).where(and(
    isNotNull(schema.slotLinks.customerLabel),
    lt(schema.slotLinks.startsAt, now),
  )).returning({ id: schema.slotLinks.id });
  return rows.length;
}

/** A exclusão da conta tira os links antes dos serviços. O FK do negócio também é CASCADE. */
export async function deleteSlotLinksForBusiness(businessId: string, database: Database = getDb()) {
  const rows = await database.delete(schema.slotLinks).where(eq(schema.slotLinks.businessId, businessId)).returning({ id: schema.slotLinks.id });
  return rows.length;
}
