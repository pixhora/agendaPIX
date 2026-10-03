import { and, asc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses, bookings, businessHours, customers, services } from "../../db/schema";
import { HttpError } from "../http";
import { findOwnedBusiness } from "../tenancy";
import { hoursSchema, serviceFormSchema, shiftDate, dateSchema } from "./validation";
import { localDate } from "../bookings/availability";

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
  await authorize(ownerId, businessId, database);
  return database.select().from(services).where(eq(services.businessId, businessId)).orderBy(asc(services.name), asc(services.id));
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
  const rows = await database.select({ id: bookings.id, startsAt: bookings.startsAt, endsAt: bookings.endsAt, status: bookings.status, expiresAt: bookings.expiresAt, priceCents: bookings.priceCents, depositCents: bookings.depositCents, serviceName: services.name, customerName: customers.name })
    .from(bookings)
    .innerJoin(services, and(eq(services.id, bookings.serviceId), eq(services.businessId, bookings.businessId)))
    .innerJoin(customers, and(eq(customers.id, bookings.customerId), eq(customers.businessId, bookings.businessId)))
    .where(and(eq(bookings.businessId, businessId), gte(bookings.startsAt, new Date(`${shiftDate(first, -1)}T00:00:00Z`)), lt(bookings.startsAt, new Date(`${shiftDate(last, 1)}T00:00:00Z`))))
    .orderBy(asc(bookings.startsAt), asc(bookings.id));
  return rows.filter((row) => dates.includes(localDate(row.startsAt, business.timezone)));
}
export async function saveDashboardService(ownerId: string, input: unknown, database: Database = getDb()) {
  const { businessId, id, ...values } = serviceFormSchema.parse(input);
  await authorize(ownerId, businessId, database);
  if (id) {
    const [result] = await database.update(services).set(values).where(and(eq(services.businessId, businessId), eq(services.id, id))).returning({ id: services.id });
    if (!result) throw new HttpError(404, "service_unavailable", "Este serviço não está disponível para seu negócio.");
  } else {
    await database.insert(services).values({ businessId, ...values });
  }
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
