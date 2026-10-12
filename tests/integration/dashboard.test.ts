import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../../lib/env";
import { dashboardBookings, dashboardCustomers, dashboardHours, dashboardServices, ownedBusinesses, saveDashboardHours, saveDashboardService } from "../../lib/dashboard/data";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL });
let client: PoolClient;
let database: NodePgDatabase<typeof schema>;
let ownerA: string, ownerB: string, businessA: string, businessB: string, serviceA: string, serviceB: string;
beforeEach(async () => {
  client = await pool.connect(); await client.query("BEGIN"); database = drizzle(client, { schema });
  ownerA = randomUUID(); ownerB = randomUUID(); businessA = randomUUID(); businessB = randomUUID(); serviceA = randomUUID(); serviceB = randomUUID();
  await database.insert(schema.user).values([ownerA, ownerB].map((id) => ({ id, name: "Dono", email: `${id}@example.com` })));
  await database.insert(schema.businesses).values([{ id: businessA, ownerId: ownerA, name: "Negócio A", slug: `a-${businessA}` }, { id: businessB, ownerId: ownerB, name: "Negócio B", slug: `b-${businessB}` }]);
  await database.insert(schema.services).values([{ id: serviceA, businessId: businessA, name: "Corte A", durationMinutes: 30, priceCents: 5000, depositCents: 1000 }, { id: serviceB, businessId: businessB, name: "Corte B", durationMinutes: 30, priceCents: 6000, depositCents: 1000 }]);
  await insertConnectedMercadoPago(database, businessA);
  await insertConnectedMercadoPago(database, businessB);
  for (const [businessId, serviceId, name] of [[businessA, serviceA, "Cliente A"], [businessB, serviceB, "Cliente B"]]) {
    const [customer] = await database.insert(schema.customers).values({ businessId, name, phone: "+5511999999999" }).returning();
    await database.insert(schema.businessHours).values({ businessId, weekday: 1, opensAt: "09:00", closesAt: "18:00" });
    await database.insert(schema.bookings).values({ businessId, serviceId, customerId: customer.id, startsAt: new Date("2030-01-02T01:00:00Z"), endsAt: new Date("2030-01-02T01:30:00Z"), priceCents: 5000, depositCents: 1000, status: "confirmed" });
  }
});
afterEach(async () => { if (client) { await client.query("ROLLBACK"); client.release(); } });
afterAll(async () => { await pool.end(); });
describe("painel isolado por negócio com PostgreSQL", () => {
  it("filtra negócios, serviços, clientes, horários e agenda pelo dono", async () => {
    expect((await ownedBusinesses(ownerA, database)).map((row) => row.id)).toEqual([businessA]);
    expect((await dashboardServices(ownerA, businessA, database)).map((row) => row.name)).toEqual(["Corte A"]);
    expect((await dashboardServices(ownerA, businessA, database))[0]).toMatchObject({ bookable: true, blockedReason: null });
    expect((await dashboardCustomers(ownerA, businessA, database)).map((row) => row.name)).toEqual(["Cliente A"]);
    expect((await dashboardHours(ownerA, businessA, database)).map((row) => row.businessId)).toEqual([businessA]);
    const rows = await dashboardBookings(ownerA, businessA, ["2030-01-01"], database);
    expect(rows.bookings.map((row) => row.customerName)).toEqual(["Cliente A"]);
    expect(rows.bookings[0]?.depositStatus).toBe("paid");
    expect(rows.reversedDepositsPendingCount).toBe(0);
    expect(await dashboardBookings(ownerA, businessA, ["2030-01-02"], database)).toEqual({ bookings: [], reversedDepositsPendingCount: 0 });
    for (const read of [dashboardServices, dashboardCustomers, dashboardHours]) await expect(read(ownerA, businessB, database)).rejects.toMatchObject({ status: 404 });
    await expect(dashboardBookings(ownerA, businessB, ["2030-01-01"], database)).rejects.toMatchObject({ status: 404 });
  });
  it("nega editar serviço e horários alheios e preserva reservas contratadas", async () => {
    const input = { businessId: businessA, id: serviceB, name: "Invadido", durationMinutes: 30, priceCents: 7000, depositCents: 1000, active: true };
    await expect(saveDashboardService(ownerA, input, database)).rejects.toMatchObject({ status: 404 });
    await expect(saveDashboardService(ownerA, { ...input, businessId: businessB }, database)).rejects.toMatchObject({ status: 404 });
    await expect(saveDashboardHours(ownerA, businessB, [], database)).rejects.toMatchObject({ status: 404 });
    await saveDashboardService(ownerA, { ...input, id: serviceA }, database);
    expect((await dashboardServices(ownerB, businessB, database))[0].name).toBe("Corte B");
    expect((await dashboardBookings(ownerA, businessA, ["2030-01-01"], database)).bookings[0].priceCents).toBe(5000);
  });
  it("recusa gravar serviço com sinal sem Mercado Pago conectado", async () => {
    await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessA));
    const [service] = await dashboardServices(ownerA, businessA, database);
    expect(service).toMatchObject({ bookable: false, blockedReason: "mp_account_not_connected" });
    await expect(saveDashboardService(ownerA, { businessId: businessA, id: serviceA, name: "Corte A", durationMinutes: 30, priceCents: 5000, depositCents: 1000, active: true }, database)).rejects.toMatchObject({ status: 409, code: "mp_account_not_connected" });
    await saveDashboardService(ownerA, { businessId: businessA, name: "Sem sinal", durationMinutes: 20, priceCents: 2000, depositCents: 0, active: true }, database);
  });
  it("salva dias atomicamente somente no próprio negócio", async () => {
    await saveDashboardHours(ownerA, businessA, [{ weekday: 2, opensAt: "10:00", closesAt: "17:00" }], database);
    expect((await dashboardHours(ownerA, businessA, database)).map((row) => row.weekday)).toEqual([2]);
    expect((await dashboardHours(ownerB, businessB, database)).map((row) => row.weekday)).toEqual([1]);
    await expect(saveDashboardHours(ownerA, businessA, [{ weekday: 2, opensAt: "18:00", closesAt: "10:00" }], database)).rejects.toThrow();
    expect((await dashboardHours(ownerA, businessA, database)).map((row) => row.weekday)).toEqual([2]);
    await saveDashboardHours(ownerA, businessA, [], database);
    expect(await dashboardHours(ownerA, businessA, database)).toEqual([]);
  });
  it("mostra o estorno do pagamento mais recente da reserva", async () => {
    const [booking] = await database.select({ id: schema.bookings.id }).from(schema.bookings).where(eq(schema.bookings.businessId, businessA)).limit(1);
    await database.insert(schema.payments).values({
      businessId: businessA,
      bookingId: booking.id,
      provider: "fake",
      idempotencyKey: randomUUID(),
      amountCents: 1000,
      expiresAt: new Date("2030-01-02T02:00:00.000Z"),
      status: "paid",
      paidAt: new Date("2030-01-01T12:00:00.000Z"),
      refundStatus: "in_process",
    });
    const [row] = (await dashboardBookings(ownerA, businessA, ["2030-01-01"], database)).bookings;
    expect(row.refundStatus).toBe("in_process");
    expect(row.manualRefundOverdue).toBe(false);
  });
});
