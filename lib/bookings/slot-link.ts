import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import {
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
import { createBooking, hash, listBookableSlots } from "./service";
import { createSlotLinkPreviewId, createSlotLinkToken, isSlotLinkPreviewId, isSlotLinkToken, slotLinkTokenHash } from "./slot-link-token";

type Database = NodePgDatabase<typeof schema>;
type LinkRow = typeof schema.slotLinks.$inferSelect;
type ServiceRow = typeof schema.services.$inferSelect;
type BusinessRow = typeof schema.businesses.$inferSelect;

const LINK_INVALID_MESSAGE = "Este link não está mais disponível.";
const LINK_EXPIRED_MESSAGE = "Este link expirou.";
const LINK_USED_MESSAGE = "Este horário já foi confirmado.";
const LINK_CONSUMED_MESSAGE = "Este link já foi usado.";
const LINK_CANCELLED_MESSAGE = "Este link não está mais disponível.";
const SLOT_TAKEN_MESSAGE = "Esse horário acabou de ser reservado.";
const SLOT_TAKEN_OWNER_MESSAGE = "Esse horário acabou de ser ocupado. Escolha outro.";
const MP_OWNER_MESSAGE = "Conecte o Mercado Pago para cobrar sinal.";
const MP_PUBLIC_MESSAGE = "Esta loja não está recebendo sinal agora.";
const BOOKINGS_PAUSED_MESSAGE = "Este estabelecimento não está aceitando novos agendamentos no momento.";

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

export function slotLinkRequestKey(linkId: string) {
  const bytes = Buffer.from(hash(`slot-link-booking:v1:${linkId}`).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
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

function presentOwner(link: LinkRow, service: ServiceRow) {
  return slotLinkOwnerSchema.parse({
    id: link.id,
    service: presentService(service),
    startsAt: iso(link.startsAt),
    expiresAt: iso(link.expiresAt),
    status: link.status,
    createdAt: iso(link.createdAt),
    previewId: link.previewId,
    customerLabel: link.customerLabel,
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
  const ownKey = slotLinkRequestKey(link.id);
  const filters = [
    eq(schema.bookings.businessId, link.businessId),
    lt(schema.bookings.startsAt, link.endsAt),
    gt(schema.bookings.endsAt, link.startsAt),
    or(isNull(schema.bookings.requestKey), ne(schema.bookings.requestKey, ownKey)),
    or(inArray(schema.bookings.status, ["confirmed", "completed"]), and(eq(schema.bookings.status, "pending_payment"), gt(schema.bookings.expiresAt, now))),
  ];
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

async function linkedPayment(database: Database, link: LinkRow) {
  if (!link.bookingId) return null;
  const [payment] = await database.select().from(schema.payments).where(and(
    eq(schema.payments.businessId, link.businessId),
    eq(schema.payments.bookingId, link.bookingId),
  )).limit(1);
  return payment ?? null;
}

async function writeStatus(database: Database, link: LinkRow, status: SlotLinkStatus, now: Date) {
  if (link.status === status || link.status === "cancelled" || link.status === "paid") return link.status;
  const [updated] = await database.update(schema.slotLinks).set({ status, updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    sql`${schema.slotLinks.status} NOT IN ('cancelled', 'paid')`,
  )).returning({ status: schema.slotLinks.status });
  return updated?.status ?? status;
}

/** Recalcula o status no banco. Pago e cancelado não voltam atrás. */
export async function refreshSlotLinkStatus(database: Database, link: LinkRow, now: Date): Promise<SlotLinkStatus> {
  if (link.status === "cancelled") return "cancelled";
  const [booking, payment, overlap] = await Promise.all([
    linkedBooking(database, link),
    linkedPayment(database, link),
    overlappingBooking(database, link, now),
  ]);
  if (link.status === "paid") return "paid";
  const paid = booking?.status === "confirmed" || booking?.status === "completed" || payment?.status === "paid";
  if (paid) return writeStatus(database, link, "paid", now);
  const holdActive = Boolean(booking && booking.status === "pending_payment" && booking.expiresAt && booking.expiresAt > now);
  if (link.bookingId) return writeStatus(database, link, holdActive ? "pending" : "expired", now);
  if (overlap) return writeStatus(database, link, "taken", now);
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
    return presentOwner({ ...row, status }, service);
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
  const now = new Date();
  const status = await refreshSlotLinkStatus(database, link, now);
  if (status === "paid" || link.bookingId || link.payStartedAt) {
    throw new HttpError(409, "link_used", LINK_USED_MESSAGE);
  }
  const service = await serviceForBusiness(database, business.id, link.serviceId, false);
  if (status === "cancelled") return presentOwner({ ...link, status }, service);
  const [updated] = await database.update(schema.slotLinks).set({ status: "cancelled", updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, business.id),
    eq(schema.slotLinks.id, link.id),
    isNull(schema.slotLinks.bookingId),
    isNull(schema.slotLinks.payStartedAt),
    sql`${schema.slotLinks.status} <> 'paid'`,
  )).returning();
  if (!updated) throw new HttpError(409, "link_used", LINK_USED_MESSAGE);
  return presentOwner(updated, service);
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
  if (!identity) return;
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
  const link = await linkByToken(database, token);
  const business = link ? await businessBySlug(database, slug) : null;
  if (!link || !business || business.id !== link.businessId || business.slug !== slug) throw invalidLink();
  await consumeSlotLinkOpenRateLimit(database, business.id, identity, config);
  const now = new Date();
  const status = await refreshSlotLinkStatus(database, link, now);
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
  if (status === "cancelled" || link.status === "cancelled") return new HttpError(409, "link_cancelled", LINK_CANCELLED_MESSAGE);
  if (status === "paid" || link.status === "paid") return new HttpError(409, "link_used", LINK_USED_MESSAGE);
  if (link.payStartedAt || link.bookingId) return new HttpError(409, "link_used", LINK_CONSUMED_MESSAGE);
  if (status === "expired" || link.expiresAt <= now) return new HttpError(410, "link_expired", LINK_EXPIRED_MESSAGE);
  if (status === "taken") return new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
  return null;
}

async function releaseClaim(database: Database, link: LinkRow) {
  await database.update(schema.slotLinks).set({ payStartedAt: null, updatedAt: new Date() }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    isNull(schema.slotLinks.bookingId),
    eq(schema.slotLinks.status, "pending"),
  ));
}

async function markTaken(database: Database, link: LinkRow) {
  const now = new Date();
  await database.update(schema.slotLinks).set({ status: "taken", payStartedAt: null, updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    sql`${schema.slotLinks.status} NOT IN ('cancelled', 'paid')`,
  ));
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
  identity: string | null,
  database: Database = getDb(),
  provider?: PaymentProvider,
  config: BookingConfig = bookingConfig(),
) {
  if (!isSlotLinkToken(token)) throw invalidLink();
  await consumeAbuseBucket("slot-link-pay-token", slotLinkTokenHash(token), config.SLOT_LINK_PAY_PER_TOKEN, "minute", database);
  const parsed = slotLinkPayRequestSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "invalid_input", "Confira os dados enviados.");
  const input = parsed.data;
  await probeLimit(database, "slot-link-pay-probe", identity, config.SLOT_LINK_PAY_PER_CLIENT);
  const link = await linkByToken(database, token);
  const business = link ? await businessBySlug(database, slug) : null;
  if (!link || !business || business.id !== link.businessId || business.slug !== slug) throw invalidLink();
  await consumeSlotLinkPayRateLimit(database, business.id, identity, config);
  const now = new Date();
  const status = await refreshSlotLinkStatus(database, link, now);
  const refusal = payRefusal(link, status, now);
  if (refusal) throw refusal;
  const service = await serviceForBusiness(database, business.id, link.serviceId, true);
  if (service.depositCents <= 0) throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
  await requireMercadoPago(business.id, database, MP_PUBLIC_MESSAGE);
  const date = localDate(link.startsAt, business.timezone);
  const slots = await listBookableSlots(business, service, date, now, database);
  if (!slots.some((slot) => slot.startsAt.getTime() === link.startsAt.getTime())) {
    await markTaken(database, link);
    throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
  }
  const [claimed] = await database.update(schema.slotLinks).set({ payStartedAt: now, updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, link.businessId),
    eq(schema.slotLinks.id, link.id),
    eq(schema.slotLinks.status, "pending"),
    isNull(schema.slotLinks.payStartedAt),
    isNull(schema.slotLinks.bookingId),
    gt(schema.slotLinks.expiresAt, now),
  )).returning({ id: schema.slotLinks.id });
  if (!claimed) {
    const [fresh] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, link.id)).limit(1);
    const current = fresh ?? link;
    const again = await refreshSlotLinkStatus(database, current, new Date());
    throw payRefusal(current, again, new Date()) ?? new HttpError(409, "link_used", LINK_CONSUMED_MESSAGE);
  }
  try {
    const result = await createBooking(business.slug, {
      serviceId: service.id,
      startsAt: link.startsAt.toISOString(),
      customer: input.customer,
      policyHash: input.policyHash,
    }, slotLinkRequestKey(link.id), database, provider, identity);
    await database.update(schema.slotLinks).set({ bookingId: result.data.bookingId, updatedAt: new Date() }).where(and(
      eq(schema.slotLinks.businessId, link.businessId),
      eq(schema.slotLinks.id, link.id),
    ));
    return payJson(result.data);
  } catch (error) {
    if (postgresCode(error) === "23P01" || (error instanceof HttpError && error.code === "slot_unavailable")) {
      await markTaken(database, link);
      throw new HttpError(409, "slot_unavailable", SLOT_TAKEN_MESSAGE);
    }
    if (error instanceof HttpError && error.code === MP_ACCOUNT_NOT_CONNECTED) {
      await releaseClaim(database, link);
      throw new HttpError(409, "mp_not_connected", MP_PUBLIC_MESSAGE);
    }
    const [existing] = await database.select({ id: schema.bookings.id }).from(schema.bookings).where(and(
      eq(schema.bookings.businessId, link.businessId),
      eq(schema.bookings.requestKey, slotLinkRequestKey(link.id)),
    )).limit(1);
    if (existing) {
      await database.update(schema.slotLinks).set({ bookingId: existing.id, updatedAt: new Date() }).where(and(
        eq(schema.slotLinks.businessId, link.businessId),
        eq(schema.slotLinks.id, link.id),
      ));
    } else {
      await releaseClaim(database, link);
    }
    throw error;
  }
}

export async function readSlotLinkPreview(previewId: string, database: Database = getDb()) {
  if (!isSlotLinkPreviewId(previewId)) throw invalidLink();
  const [link] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.previewId, previewId)).limit(1);
  if (!link) throw invalidLink();
  const [business] = await database.select().from(schema.businesses).where(eq(schema.businesses.id, link.businessId)).limit(1);
  const [service] = await database.select().from(schema.services).where(and(
    eq(schema.services.businessId, link.businessId),
    eq(schema.services.id, link.serviceId),
  )).limit(1);
  if (!business || !service) throw invalidLink();
  return slotLinkPreviewResponseSchema.parse({
    businessName: business.name,
    serviceName: service.name,
    date: localDate(link.startsAt, business.timezone),
    time: localClock(link.startsAt, business.timezone),
  });
}
