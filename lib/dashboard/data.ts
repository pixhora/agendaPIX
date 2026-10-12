import { and, asc, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses, bookings, businessHours, customers, services } from "../../db/schema";
import { deriveDepositStatus, ownerAgendaResponseSchema, type DepositReversalReason, type DepositStatus } from "../contracts/deposit-status";
import { isPostgresCode, isUndefinedColumn } from "../postgres-error";
import { loadBookingAccess } from "../billing/load";
import { serviceListingBookability } from "../bookings/deposit-bookability";
import { invalidatePublicCatalog } from "../bookings/public-cache";
import { HttpError } from "../http";
import { assertMpConnectedForDeposit, getServiceBlockedReason, readMpDepositGate } from "../mercadopago-oauth/bookability";
import { createDrizzleMpStore } from "../mercadopago-oauth/repository";
import { findOwnedBusiness } from "../tenancy";
import { contactWhatsappSchema } from "../validation/whatsapp";
import { hoursSchema, serviceFormSchema, shiftDate, dateSchema } from "./validation";
import { localDate } from "../bookings/availability";
import { manualRefundFlags } from "../payments/manual-refund-calendar";

type Database = Omit<ReturnType<typeof getDb>, "$client">;
type OwnedBusiness = typeof businesses.$inferSelect;
export async function ownedBusinesses(ownerId: string, database: Database = getDb()) {
  return database.select().from(businesses).where(eq(businesses.ownerId, z.string().min(1).parse(ownerId))).orderBy(desc(businesses.createdAt), desc(businesses.id));
}
/** Negócios com ao menos um serviço ativo que cobra sinal. Uma query para a moldura do painel. */
export async function businessesWithDeposit(businessIds: string[], database: Database = getDb()) {
  if (!businessIds.length) return new Set<string>();
  const rows = await database.select({ businessId: services.businessId }).from(services).where(and(
    inArray(services.businessId, businessIds),
    eq(services.active, true),
    gt(services.depositCents, 0),
  ));
  return new Set(rows.map((row) => row.businessId));
}
async function authorize(ownerId: string, businessId: string, database: Database) {
  const business = await findOwnedBusiness(businessId, ownerId, database);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  return business;
}
function resolveOwned(ownerId: string, businessId: string, database: Database, known?: OwnedBusiness) {
  if (known && known.id === businessId && known.ownerId === ownerId) return Promise.resolve(known);
  return authorize(ownerId, businessId, database);
}
export async function dashboardServices(ownerId: string, businessId: string, database: Database = getDb(), known?: OwnedBusiness) {
  const business = await resolveOwned(ownerId, businessId, database, known);
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
export async function dashboardCustomers(ownerId: string, businessId: string, database: Database = getDb(), known?: OwnedBusiness) {
  await resolveOwned(ownerId, businessId, database, known);
  return database.select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email }).from(customers).where(eq(customers.businessId, businessId)).orderBy(asc(customers.name), asc(customers.id));
}
export async function dashboardHours(ownerId: string, businessId: string, database: Database = getDb(), known?: OwnedBusiness) {
  await resolveOwned(ownerId, businessId, database, known);
  return database.select().from(businessHours).where(eq(businessHours.businessId, businessId)).orderBy(asc(businessHours.weekday));
}
export async function dashboardBookings(ownerId: string, businessId: string, dates: string[], database: Database = getDb(), known?: OwnedBusiness) {
  const business = await resolveOwned(ownerId, businessId, database, known);
  const loaded = await readAgendaTolerant(database, async (source, reversalColumns) => {
    const rows = await selectAgendaRows(source, businessId, dates, business.timezone, reversalColumns);
    const reversedDepositsPendingCount = reversalColumns ? await countUnackedReversals(source, businessId) : 0;
    return ownerAgendaResponseSchema.parse({ bookings: rows, reversedDepositsPendingCount });
  });
  return loaded;
}
export async function dashboardBookingDetail(ownerId: string, businessId: string, bookingId: string, database: Database = getDb(), known?: OwnedBusiness) {
  const business = await resolveOwned(ownerId, businessId, database, known);
  return readAgendaTolerant(database, async (source, reversalColumns) => {
    const [row] = await selectAgendaRows(source, businessId, null, business.timezone, reversalColumns, bookingId);
    if (!row) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
    return row;
  });
}
type PaymentRefundJson = {
  refundStatus: string | null;
  refundedAt: string | null;
  manualRefundDueAt: string | null;
  manualRefundOpen: boolean;
  paymentStatus: string | null;
  autoLateRefund: boolean;
} | null;

function bookingRefundColumns(reversalColumns: boolean) {
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
    depositReversedAt: reversalColumns ? bookings.depositReversedAt : sql<Date | null>`null`,
    depositReversalReason: reversalColumns ? bookings.depositReversalReason : sql<DepositReversalReason | null>`null`,
    depositReversalSeenAt: reversalColumns ? bookings.depositReversalSeenAt : sql<Date | null>`null`,
    payment: sql<PaymentRefundJson>`(
      select json_build_object(
        'refundStatus', p.refund_status,
        'refundedAt', p.refunded_at,
        'manualRefundDueAt', p.manual_refund_due_at,
        'paymentStatus', p.status,
        'autoLateRefund', exists (
          select 1 from payment_refunds r
          where r.payment_id = p.id
            and r.kind = 'auto_late'
            and r.status in ('requested', 'processing', 'refunded')
        ),
        'manualRefundOpen', (
          p.manual_refund_due_at is not null
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
        )
      )
      from payments p
      where p.business_id = ${bookings.businessId} and p.booking_id = ${bookings.id}
      order by p.created_at desc
      limit 1
    )`,
  };
}
async function selectAgendaRows(database: Database, businessId: string, dates: string[] | null, timezone: string, reversalColumns: boolean, bookingId?: string) {
  const first = dates ? dateSchema.parse(dates[0]) : null;
  const last = dates ? shiftDate(dateSchema.parse(dates[dates.length - 1]), 1) : null;
  const rows = await database.select(bookingRefundColumns(reversalColumns))
    .from(bookings)
    .innerJoin(services, and(eq(services.id, bookings.serviceId), eq(services.businessId, bookings.businessId)))
    .innerJoin(customers, and(eq(customers.id, bookings.customerId), eq(customers.businessId, bookings.businessId)))
    .where(and(
      eq(bookings.businessId, businessId),
      bookingId ? eq(bookings.id, bookingId) : undefined,
      first && last ? gte(bookings.startsAt, new Date(`${shiftDate(first, -1)}T00:00:00Z`)) : undefined,
      first && last ? lt(bookings.startsAt, new Date(`${shiftDate(last, 1)}T00:00:00Z`)) : undefined,
    ))
    .orderBy(asc(bookings.startsAt), asc(bookings.id));
  const visible = dates ? rows.filter((row) => dates.includes(localDate(row.startsAt, timezone))) : rows;
  return visible.map((row) => presentBooking(withPayment(row), timezone));
}
async function countUnackedReversals(database: Database, businessId: string) {
  const [row] = await database.select({ count: sql<number>`count(*)::int` }).from(bookings).where(and(
    eq(bookings.businessId, businessId),
    sql`${bookings.depositReversalReason} in ('refunded', 'charged_back')`,
    sql`${bookings.depositReversalSeenAt} is null`,
  ));
  return row?.count ?? 0;
}
function usesDedicatedConnection(database: Database) {
  const client = (database as { $client?: { release?: unknown } }).$client;
  return typeof client?.release === "function";
}
async function readAgendaTolerant<T>(database: Database, read: (source: Database, reversalColumns: boolean) => Promise<T>) {
  const savepoint = usesDedicatedConnection(database);
  if (savepoint) {
    try {
      await database.execute(sql`SAVEPOINT agenda_deposit_reversal`);
    } catch (error) {
      if (!isPostgresCode(error, "25P01")) throw error;
      return readWithoutSavepoint(database, read);
    }
    try {
      const value = await read(database, true);
      await database.execute(sql`RELEASE SAVEPOINT agenda_deposit_reversal`);
      return value;
    } catch (error) {
      await database.execute(sql`ROLLBACK TO SAVEPOINT agenda_deposit_reversal`);
      await database.execute(sql`RELEASE SAVEPOINT agenda_deposit_reversal`);
      if (!isUndefinedColumn(error)) throw error;
      console.warn("[agenda] colunas de devolução do sinal ausentes (42703); depositStatus derivado dos dados atuais");
      return read(database, false);
    }
  }
  return readWithoutSavepoint(database, read);
}
async function readWithoutSavepoint<T>(database: Database, read: (source: Database, reversalColumns: boolean) => Promise<T>) {
  try {
    return await read(database, true);
  } catch (error) {
    if (!isUndefinedColumn(error)) throw error;
    console.warn("[agenda] colunas de devolução do sinal ausentes (42703); depositStatus derivado dos dados atuais");
    return read(database, false);
  }
}
function withPayment<T extends { payment: PaymentRefundJson }>(row: T) {
  const payment = row.payment;
  const { payment: _payment, ...rest } = row;
  void _payment;
  return {
    ...rest,
    refundStatus: payment?.refundStatus ?? null,
    refundedAt: payment?.refundedAt ?? null,
    manualRefundDueAt: payment?.manualRefundDueAt ?? null,
    manualRefundOpen: Boolean(payment?.manualRefundOpen),
    paymentStatus: payment?.paymentStatus ?? null,
    autoLateRefund: Boolean(payment?.autoLateRefund),
  };
}
function isoOrNull(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function reversalReasonOf(value: unknown): DepositReversalReason | null {
  return value === "refunded" || value === "charged_back" ? value : null;
}
function presentBooking<T extends {
  refundStatus: string | null;
  refundedAt: Date | string | null;
  manualRefundDueAt: Date | string | null;
  manualRefundOpen: boolean | null;
  paymentStatus: string | null;
  autoLateRefund: boolean;
  depositCents: number;
  status: string;
  depositReversalReason: DepositReversalReason | string | null;
  depositReversalSeenAt: Date | string | null;
  depositReversedAt: Date | string | null;
}>(row: T, timezone: string, now = new Date()) {
  const { manualRefundOpen, manualRefundDueAt, paymentStatus, autoLateRefund, depositReversedAt, depositReversalReason, depositReversalSeenAt, ...rest } = row;
  void depositReversedAt;
  const refundStatus = row.refundStatus === "in_process" || row.refundStatus === "refunded" || row.refundStatus === "failed" ? row.refundStatus : null;
  const dueAt = isoOrNull(manualRefundDueAt);
  const flags = manualRefundFlags({
    dueAt: dueAt ? new Date(dueAt) : null,
    open: Boolean(manualRefundOpen) && Boolean(dueAt),
    now,
    timeZone: timezone,
  });
  const reason = reversalReasonOf(depositReversalReason);
  const depositStatus: DepositStatus = deriveDepositStatus({
    depositCents: row.depositCents,
    bookingStatus: row.status,
    paymentStatus,
    refundStatus,
    reversalReason: reason,
    autoLateRefund,
  });
  return { ...rest, refundStatus, refundedAt: isoOrNull(row.refundedAt), manualRefundDueAt: dueAt, ...flags, depositStatus, depositReversalSeenAt: isoOrNull(depositReversalSeenAt) };
}
export type DashboardBooking = ReturnType<typeof presentBooking>;
export async function saveDashboardService(ownerId: string, input: unknown, database: Database = getDb()) {
  const { businessId, id, ...values } = serviceFormSchema.parse(input);
  const business = await authorize(ownerId, businessId, database);
  if (values.depositCents > 0 && values.active) await assertMpConnectedForDeposit(businessId, { store: createDrizzleMpStore(database) });
  if (id) {
    const [result] = await database.update(services).set(values).where(and(eq(services.businessId, businessId), eq(services.id, id))).returning({ id: services.id });
    if (!result) throw new HttpError(404, "service_unavailable", "Este serviço não está disponível para seu negócio.");
  } else {
    await database.insert(services).values({ businessId, ...values });
  }
  await invalidatePublicCatalog(business.slug);
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
  const business = await authorize(ownerId, z.uuid().parse(businessId), database);
  const contactWhatsapp = contactWhatsappSchema.parse(input);
  await database.update(businesses).set({ contactWhatsapp }).where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId)));
  await invalidatePublicCatalog(business.slug);
  return { contactWhatsapp };
}

export async function saveDashboardHours(ownerId: string, businessId: string, input: unknown, database: Database = getDb()) {
  const values = hoursSchema.parse(input);
  const business = await authorize(ownerId, businessId, database);
  await database.transaction(async (transaction) => {
    // Serializa alterações do mesmo negócio e evita perder dias em gravações simultâneas.
    await transaction.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId))).for("update");
    await transaction.delete(businessHours).where(eq(businessHours.businessId, businessId));
    if (values.length) await transaction.insert(businessHours).values(values.map((value) => ({ businessId, ...value })));
  });
  await invalidatePublicCatalog(business.slug);
}
