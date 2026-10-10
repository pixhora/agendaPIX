import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { getBookingAccess, type SubscriptionAccess } from "../billing/access";
import { depositGate } from "../mercadopago-oauth/credentials";
import type { MpConnection } from "../mercadopago-oauth/types";
import { getServiceBlockedReason } from "../mercadopago-oauth/bookability";
import { payerCpfRequired, resolvePixRecipientDisplayName } from "../marketing/facts";
import { depositPolicySchema } from "../policy/schema";
import { policyHashFor } from "../policy/hash";
import { policySummary } from "../policy/text";
import { getDb } from "../../db";
import { HttpError } from "../http";
import { availableSlots, type Slot } from "./availability";
import { bookingConfig } from "./config";
import { serviceListingBookability } from "./deposit-bookability";
import { depositSlotAllowed } from "./hold";
import { PUBLIC_CATALOG_REVALIDATE_SECONDS, publicCatalogTag } from "./public-cache";
import { slugSchema } from "./validation";

type Database = NodePgDatabase<typeof schema>;

export type CatalogService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  depositPolicy: unknown;
  active: boolean;
};

export type CatalogHour = { weekday: number; opensAt: string; closesAt: string };

export type PublicCatalog = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  contactWhatsapp: string | null;
  trialEndsAt: Date;
  ownerName: string;
  subscription: SubscriptionAccess | null;
  mp: {
    status: string;
    hasTokens: boolean;
    expiresAt: Date | null;
    liveMode: boolean | null;
    consentVersion: string | null;
    autoRefundAckAt: Date | null;
  } | null;
  services: CatalogService[];
  hours: CatalogHour[];
};

type CatalogJson = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  contactWhatsapp: string | null;
  trialEndsAt: string;
  ownerName: string;
  subscription: { status: SubscriptionAccess["status"]; currentPeriodEnd: string | null; provider: string | null } | null;
  mp: {
    status: string;
    hasTokens: boolean;
    expiresAt: string | null;
    liveMode: boolean | null;
    consentVersion: string | null;
    autoRefundAckAt: string | null;
  } | null;
  services: CatalogService[];
  hours: CatalogHour[];
};

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function clock(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

/** Uma ida ao banco: negócio, dono, assinatura, Mercado Pago, serviços ativos e horários. */
export async function loadPublicCatalog(slug: string, database: Database): Promise<PublicCatalog> {
  const parsed = slugSchema.parse(slug);
  const result = await database.execute<{
    id: string;
    name: string;
    slug: string;
    timezone: string;
    contact_whatsapp: string | null;
    trial_ends_at: Date | string;
    owner_name: string;
    sub_status: SubscriptionAccess["status"] | null;
    sub_period_end: Date | string | null;
    sub_provider: string | null;
    mp_status: string | null;
    mp_has_tokens: boolean | null;
    mp_expires_at: Date | string | null;
    mp_live_mode: boolean | null;
    mp_consent_version: string | null;
    mp_auto_refund_ack_at: Date | string | null;
    services: unknown;
    hours: unknown;
  }>(sql`
    SELECT
      b.id,
      b.name,
      b.slug,
      b.timezone,
      b.contact_whatsapp,
      b.trial_ends_at,
      u.name AS owner_name,
      sub.status AS sub_status,
      sub.current_period_end AS sub_period_end,
      sub.provider AS sub_provider,
      mp.status AS mp_status,
      (mp.access_token_enc IS NOT NULL AND mp.refresh_token_enc IS NOT NULL
        AND length(mp.access_token_enc) > 0 AND length(mp.refresh_token_enc) > 0) AS mp_has_tokens,
      mp.expires_at AS mp_expires_at,
      mp.live_mode AS mp_live_mode,
      mp.consent_version AS mp_consent_version,
      mp.auto_refund_ack_at AS mp_auto_refund_ack_at,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', s.id,
          'name', s.name,
          'durationMinutes', s.duration_minutes,
          'priceCents', s.price_cents,
          'depositCents', s.deposit_cents,
          'depositPolicy', s.deposit_policy,
          'active', s.active
        ))
        FROM services s
        WHERE s.business_id = b.id AND s.active = true
      ), '[]'::json) AS services,
      COALESCE((
        SELECT json_agg(json_build_object(
          'weekday', h.weekday,
          'opensAt', to_char(h.opens_at, 'HH24:MI:SS'),
          'closesAt', to_char(h.closes_at, 'HH24:MI:SS')
        ))
        FROM business_hours h
        WHERE h.business_id = b.id
      ), '[]'::json) AS hours
    FROM businesses b
    INNER JOIN "user" u ON u.id = b.owner_id
    LEFT JOIN subscriptions sub ON sub.business_id = b.id
    LEFT JOIN mercadopago_connections mp ON mp.business_id = b.id
    WHERE b.slug = ${parsed}
    LIMIT 1
  `);
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
  const trialEndsAt = asDate(row.trial_ends_at);
  if (!trialEndsAt) throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
  const services = asJson<CatalogService[]>(row.services, []).map((service) => ({
    ...service,
    durationMinutes: Number(service.durationMinutes),
    priceCents: Number(service.priceCents),
    depositCents: Number(service.depositCents),
    active: Boolean(service.active),
  }));
  const hours = asJson<CatalogHour[]>(row.hours, []).map((hour) => ({
    weekday: Number(hour.weekday),
    opensAt: clock(hour.opensAt),
    closesAt: clock(hour.closesAt),
  }));
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    contactWhatsapp: row.contact_whatsapp,
    trialEndsAt,
    ownerName: row.owner_name,
    subscription: row.sub_status ? {
      status: row.sub_status,
      currentPeriodEnd: asDate(row.sub_period_end),
      provider: row.sub_provider,
    } : null,
    mp: row.mp_status ? {
      status: row.mp_status,
      hasTokens: Boolean(row.mp_has_tokens),
      expiresAt: asDate(row.mp_expires_at),
      liveMode: row.mp_live_mode,
      consentVersion: row.mp_consent_version,
      autoRefundAckAt: asDate(row.mp_auto_refund_ack_at),
    } : null,
    services,
    hours,
  };
}

export function serializeCatalog(catalog: PublicCatalog): CatalogJson {
  return {
    ...catalog,
    trialEndsAt: catalog.trialEndsAt.toISOString(),
    subscription: catalog.subscription ? {
      status: catalog.subscription.status,
      currentPeriodEnd: catalog.subscription.currentPeriodEnd?.toISOString() ?? null,
      provider: catalog.subscription.provider ?? null,
    } : null,
    mp: catalog.mp ? {
      ...catalog.mp,
      expiresAt: catalog.mp.expiresAt?.toISOString() ?? null,
      autoRefundAckAt: catalog.mp.autoRefundAckAt?.toISOString() ?? null,
    } : null,
  };
}

export function hydrateCatalog(json: CatalogJson): PublicCatalog {
  return {
    ...json,
    trialEndsAt: new Date(json.trialEndsAt),
    subscription: json.subscription ? {
      status: json.subscription.status,
      currentPeriodEnd: asDate(json.subscription.currentPeriodEnd),
      provider: json.subscription.provider,
    } : null,
    mp: json.mp ? {
      ...json.mp,
      expiresAt: asDate(json.mp.expiresAt),
      autoRefundAckAt: asDate(json.mp.autoRefundAckAt),
    } : null,
  };
}

function mpGate(catalog: PublicCatalog, now: Date) {
  if (!catalog.mp) return { mpConnected: false, liveMode: null as boolean | null, consentCurrent: false };
  const row = {
    status: catalog.mp.status,
    accessTokenEnc: catalog.mp.hasTokens ? "present" : null,
    refreshTokenEnc: catalog.mp.hasTokens ? "present" : null,
    expiresAt: catalog.mp.expiresAt,
    consentVersion: catalog.mp.consentVersion,
    autoRefundAckAt: catalog.mp.autoRefundAckAt,
  } as MpConnection;
  const gate = depositGate(row, now);
  return { mpConnected: gate.connected, liveMode: catalog.mp.liveMode, consentCurrent: gate.consentCurrent };
}

function publicPolicy(service: CatalogService, businessName: string) {
  if (service.depositCents <= 0) return { depositPolicy: null, policySummary: null, policyHash: null };
  const policy = depositPolicySchema.parse(service.depositPolicy);
  return {
    depositPolicy: policy,
    policySummary: policySummary(policy, { depositCents: service.depositCents, businessName }),
    policyHash: policyHashFor(policy, { depositCents: service.depositCents }),
  };
}

export function presentPublicServices(catalog: PublicCatalog, now = new Date()) {
  const access = getBookingAccess(catalog, catalog.subscription, now);
  const gate = mpGate(catalog, now);
  return {
    name: catalog.name,
    timezone: catalog.timezone,
    address: null,
    phone: null,
    logoUrl: null,
    contactWhatsapp: catalog.contactWhatsapp,
    bookingsPaused: access.bookingsPaused,
    requiresPayerCpf: payerCpfRequired(),
    pixRecipientDisplayName: resolvePixRecipientDisplayName(catalog.ownerName, catalog.name),
    services: catalog.services.map((service) => {
      const listing = serviceListingBookability(catalog, service, access);
      const blocked = listing.blockedReason === "bookings_paused" ? null : getServiceBlockedReason(service, gate);
      const bookability = blocked ? { bookable: false, blockedReason: blocked } : listing;
      return {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        depositCents: service.depositCents,
        ...publicPolicy(service, catalog.name),
        ...bookability,
      };
    }),
  };
}

export function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Datas pedidas na query, no máximo 7, sempre incluindo o dia principal. */
export function availabilityDates(date: string, dates: string | undefined) {
  if (!dates) return [date];
  const unique = [...new Set(dates.split(",").filter(Boolean))];
  if (unique.length > 7 || unique.some((value) => !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
    throw new HttpError(400, "invalid_input", "Confira os dados enviados.");
  }
  return unique.includes(date) ? unique : [date, ...unique].slice(0, 7);
}

export function slotsForCatalog(catalog: PublicCatalog, service: CatalogService, date: string, busy: Slot[], now: Date) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const hours = catalog.hours.find((hour) => hour.weekday === weekday) ?? null;
  const slots = availableSlots({
    date,
    timezone: catalog.timezone,
    durationMinutes: service.durationMinutes,
    hours,
    busy,
    now,
  });
  if (service.depositCents <= 0) return slots;
  return slots.filter((slot) => depositSlotAllowed(slot.startsAt, now, bookingConfig().BOOKING_HOLD_MINUTES));
}

/**
 * Catálogo público (serviços, horários, perfil). A ocupação dos horários não entra aqui.
 * Fora do Next (testes) lê direto do banco. No servidor, revalida na hora em que o dono muda o cadastro.
 */
export async function readCachedCatalog(slug: string): Promise<PublicCatalog> {
  const load = async () => serializeCatalog(await loadPublicCatalog(slug, getDb()));
  if (!process.env.NEXT_RUNTIME) return hydrateCatalog(await load());
  const { unstable_cache } = await import("next/cache");
  const cached = unstable_cache(load, ["public-catalog-v1", slug], {
    tags: [publicCatalogTag(slug)],
    revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS,
  });
  return hydrateCatalog(await cached());
}

/** Horários ocupados de um intervalo. A disponibilidade continua lendo isto ao vivo. */
export async function busyIntervals(database: Database, businessId: string, dates: string[], now: Date) {
  const first = dates.reduce((min, date) => date < min ? date : min);
  const last = dates.reduce((max, date) => date > max ? date : max);
  const start = new Date(Date.parse(`${first}T00:00:00Z`) - 86400000);
  const end = new Date(Date.parse(`${last}T00:00:00Z`) + 172800000);
  return database.select({ startsAt: schema.bookings.startsAt, endsAt: schema.bookings.endsAt }).from(schema.bookings).where(and(
    eq(schema.bookings.businessId, businessId),
    lt(schema.bookings.startsAt, end),
    gt(schema.bookings.endsAt, start),
    or(
      inArray(schema.bookings.status, ["confirmed", "completed"]),
      and(eq(schema.bookings.status, "pending_payment"), gt(schema.bookings.expiresAt, now)),
    ),
  ));
}
