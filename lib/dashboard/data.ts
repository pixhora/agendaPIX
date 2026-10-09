import { and, asc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses, bookings, businessHours, customers, services } from "../../db/schema";
import { loadBookingAccess } from "../billing/load";
import { serviceListingBookability } from "../bookings/deposit-bookability";
import { HttpError } from "../http";
import { assertMpConnectedForDeposit, getServiceBlockedReason, readMpDepositGate } from "../mercadopago-oauth/bookability";
import { createDrizzleMpStore } from "../mercadopago-oauth/repository";
import { findOwnedBusiness } from "../tenancy";
import { contactWhatsappSchema } from "../validation/whatsapp";
import { hoursSchema, serviceFormSchema, shiftDate, dateSchema } from "./validation";
import { localDate } from "../bookings/availability";
import { manualRefundFlags } from "../payments/manual-refund-calendar";

type Database = Omit<ReturnType<typeof getDb>, "$client">;
export async function ownedBusinesses(ownerId: string, database: Database = getDb()) {
  return database.select().from(businesses).where(eq(businesses.ownerId, z.string().min(1).parse(ownerId))).orderBy(asc(businesses.createdAt), asc(businesses.id));
}
async function authorize(ownerId: string, businessId: string, database: Database) {
  const business = await findOwnedBusiness(businessId, ownerId, database);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  return business;
}
export async function dashboardServices(ownerId: string, businessId: string, database: Database = getDb()) {
  const business = await authorize(ownerId, businessId, database);
  const rows = await database.select().from(services).where(eq(services.businessId, businessId)).orderBy(asc(services.name), asc(services.id));
  const access = await loadBookingAccess(business, database);
  const mpGate = await readMpDepositGate(businessId, { store: createDrizzleMpStore(database) });
  return rows.map((service) => {
    const listing = serviceListingBookability(business, service, access);
    if (listing.blockedReason === "bookings_paused") return { ...service, ...listing };
    const mpReason = getServiceBlockedReason(service, mpGate);
    if (mpReason) return { ...service, bookable: false, blockedReason: mpReason };
    return { ...service, ...listing };
  });
}
export async function dashboardCustomers(ownerId: string, businessId: string, database: Database = getDb()) {
  await authorize(ownerId, businessId, database);
  return database.select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email }).from(customers).where(eq(customers.businessId, businessId)).orderBy(asc(customers.name), asc(customers.id));
}
export async function dashboardHours(ownerId: string, businessId: string, database: Database = getDb()) {
  await authorize(ownerId, businessId, database);
  return database.select().from(businessHours).where(eq(businessHours.businessId, businessId)).orderBy(asc(businessHours.weekday));
}
export async function dashboardBookings(ownerId: string, businessId: string, dates: string[], database: Database = getDb()) {
  const business = await authorize(ownerId, businessId, database);
  const first = dateSchema.parse(dates[0]);
  const last = shiftDate(dateSchema.parse(dates[dates.length - 1]), 1);
  // Intervalo amplo de UTC cobre o dia local em qualquer offset; filtro final usa o fuso do negócio.
  const rows = await database.select(bookingRefundColumns())
    .from(bookings)
    .innerJoin(services, and(eq(services.id, bookings.serviceId), eq(services.businessId, bookings.businessId)))
    .innerJoin(customers, and(eq(customers.id, bookings.customerId), eq(customers.businessId, bookings.businessId)))
    .where(and(eq(bookings.businessId, businessId), gte(bookings.startsAt, new Date(`${shiftDate(first, -1)}T00:00:00Z`)), lt(bookings.startsAt, new Date(`${shiftDate(last, 1)}T00:00:00Z`))))
    .orderBy(asc(bookings.startsAt), asc(bookings.id));
  return rows.filter((row) => dates.includes(localDate(row.startsAt, business.timezone))).map((row) => presentBooking(row, business.timezone));
}
export async function dashboardBookingDetail(ownerId: string, businessId: string, bookingId: string, database: Database = getDb()) {
  const business = await authorize(ownerId, businessId, database);
  const [row] = await database.select(bookingRefundColumns())
    .from(bookings)
    .innerJoin(services, and(eq(services.id, bookings.serviceId), eq(services.businessId, bookings.businessId)))
    .innerJoin(customers, and(eq(customers.id, bookings.customerId), eq(customers.businessId, bookings.businessId)))
    .where(and(eq(bookings.businessId, businessId), eq(bookings.id, bookingId)))
    .limit(1);
  if (!row) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  return presentBooking(row, business.timezone);
}
function bookingRefundColumns() {
  return {
    id: bookings.id,
    startsAt: bookings.startsAt,
    endsAt: bookings.endsAt,
    status: bookings.status,
    expiresAt: bookings.expiresAt,
    priceCents: bookings.priceCents,
    depositCents: bookings.depositCents,
    serviceName: services.name,
    customerName: customers.name,
    customerPhone: customers.phone,
    refundStatus: refundStatusSql(),
    refundedAt: refundedAtSql(),
    manualRefundDueAt: manualRefundDueAtSql(),
    manualRefundOpen: manualRefundOpenSql(),
  };
}
function refundStatusSql() {
  return sql<string | null>`(select p.refund_status from payments p where p.business_id = ${bookings.businessId} and p.booking_id = ${bookings.id} order by p.created_at desc limit 1)`;
}
function refundedAtSql() {
  return sql<Date | string | null>`(select p.refunded_at from payments p where p.business_id = ${bookings.businessId} and p.booking_id = ${bookings.id} order by p.created_at desc limit 1)`;
}
function manualRefundDueAtSql() {
  return sql<Date | string | null>`(select p.manual_refund_due_at from payments p where p.business_id = ${bookings.businessId} and p.booking_id = ${bookings.id} order by p.created_at desc limit 1)`;
}
function manualRefundOpenSql() {
  return sql<boolean>`coalesce((
    select p.manual_refund_due_at is not null
      and p.status is distinct from 'refunded'
      and (p.refund_status is null or p.refund_status = 'failed')
      and not exists (
        select 1 from payment_refunds r
        where r.payment_id = p.id and r.status in ('requested', 'processing', 'refunded')
      )
      and not exists (
        select 1 from payment_audit a
        where a.payment_id = p.id
          and a.action in ('owner_manual_mark', 'owner_review_refund_marked', 'owner_review_confirmed')
      )
    from payments p
    where p.business_id = ${bookings.businessId} and p.booking_id = ${bookings.id}
    order by p.created_at desc
    limit 1
  ), false)`;
}
function isoOrNull(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function presentBooking<T extends { refundStatus: string | null; refundedAt: Date | string | null; manualRefundDueAt: Date | string | null; manualRefundOpen: boolean | null }>(row: T, timezone: string, now = new Date()) {
  const { manualRefundOpen, manualRefundDueAt, ...rest } = row;
  const refundStatus = row.refundStatus === "in_process" || row.refundStatus === "refunded" || row.refundStatus === "failed" ? row.refundStatus : null;
  const dueAt = isoOrNull(manualRefundDueAt);
  const flags = manualRefundFlags({
    dueAt: dueAt ? new Date(dueAt) : null,
    open: Boolean(manualRefundOpen) && Boolean(dueAt),
    now,
    timeZone: timezone,
  });
  return { ...rest, refundStatus, refundedAt: isoOrNull(row.refundedAt), manualRefundDueAt: dueAt, ...flags };
}
export type DashboardBooking = Awaited<ReturnType<typeof dashboardBookings>>[number];
export async function saveDashboardService(ownerId: string, input: unknown, database: Database = getDb()) {
  const { businessId, id, ...values } = serviceFormSchema.parse(input);
  await authorize(ownerId, businessId, database);
  if (values.depositCents > 0 && values.active) await assertMpConnectedForDeposit(businessId, { store: createDrizzleMpStore(database) });
  if (id) {
    const [result] = await database.update(services).set(values).where(and(eq(services.businessId, businessId), eq(services.id, id))).returning({ id: services.id });
    if (!result) throw new HttpError(404, "service_unavailable", "Este serviço não está disponível para seu negócio.");
  } else {
    await database.insert(services).values({ businessId, ...values });
  }
}
export async function countFutureConfirmedBookings(ownerId: string, businessId: string, serviceId: string, database: Database = getDb(), now = new Date()) {
  await authorize(ownerId, businessId, database);
  const id = z.uuid().parse(serviceId);
  const [service] = await database.select({ id: services.id }).from(services).where(and(eq(services.businessId, businessId), eq(services.id, id))).limit(1);
  if (!service) throw new HttpError(404, "service_unavailable", "Este serviço não está disponível para seu negócio.");
  const [row] = await database.select({ count: sql<number>`count(*)::int` }).from(bookings).where(and(
    eq(bookings.businessId, businessId),
    eq(bookings.serviceId, id),
    eq(bookings.status, "confirmed"),
    gt(bookings.startsAt, now),
  ));
  return { count: row?.count ?? 0 };
}

export async function saveContactWhatsapp(ownerId: string, businessId: string, input: unknown, database: Database = getDb()) {
  await authorize(ownerId, z.uuid().parse(businessId), database);
  const contactWhatsapp = contactWhatsappSchema.parse(input);
  await database.update(businesses).set({ contactWhatsapp }).where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId)));
  return { contactWhatsapp };
}

export async function saveDashboardHours(ownerId: string, businessId: string, input: unknown, database: Database = getDb()) {
  const values = hoursSchema.parse(input);
  await authorize(ownerId, businessId, database);
  await database.transaction(async (transaction) => {
    // Serializa alterações do mesmo negócio e evita perder dias em gravações simultâneas.
    await transaction.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId))).for("update");
    await transaction.delete(businessHours).where(eq(businessHours.businessId, businessId));
    if (values.length) await transaction.insert(businessHours).values(values.map((value) => ({ businessId, ...value })));
  });
}
