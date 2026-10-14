import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { createDrizzleWeeklySummaryPorts, runWeeklySummaries } from "../../lib/dashboard/weekly-summary";
import { databaseEnvSchema } from "../../lib/env";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
// Segunda, 12 out 2026, 11:00 em São Paulo. Semana resumida: seg 5 a dom 11 de outubro (local).
const now = new Date("2026-10-12T14:00:00.000Z");

let ownerId: string;
let unverifiedOwnerId: string;
let businessId: string;
let quietBusinessId: string;
let serviceId: string;
let customerId: string;

async function booking(startsAt: string, status: "confirmed" | "completed" | "cancelled", depositCents: number, reversed = false) {
  const start = new Date(startsAt);
  await database.insert(schema.bookings).values({
    businessId, serviceId, customerId, status, startsAt: start, endsAt: new Date(start.getTime() + 30 * 60_000),
    priceCents: 5000, depositCents,
    ...(reversed ? { depositReversedAt: now, depositReversalReason: "refunded" as const } : {}),
  });
}

beforeEach(async () => {
  ownerId = randomUUID();
  unverifiedOwnerId = randomUUID();
  businessId = randomUUID();
  quietBusinessId = randomUUID();
  serviceId = randomUUID();
  customerId = randomUUID();
  await database.insert(schema.user).values([
    { id: ownerId, name: "Ana Souza", email: `${ownerId}@example.com`, emailVerified: true },
    { id: unverifiedOwnerId, name: "Sem confirmar", email: `${unverifiedOwnerId}@example.com`, emailVerified: false },
  ]);
  await database.insert(schema.businesses).values([
    { id: businessId, ownerId, name: "Studio Bella", slug: `ws-${businessId}`, timezone: "America/Sao_Paulo" },
    { id: quietBusinessId, ownerId: unverifiedOwnerId, name: "Quieto", slug: `ws-${quietBusinessId}`, timezone: "America/Sao_Paulo" },
  ]);
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.customers).values({ id: customerId, businessId, name: "Bia", phone: "+5511988887777", createdAt: new Date("2026-10-07T13:00:00.000Z") });

  await booking("2026-10-06T15:00:00.000Z", "confirmed", 1000);           // terça: conta
  await booking("2026-10-12T02:30:00.000Z", "completed", 2000);           // dom 23:30 local: ainda é a semana passada
  await booking("2026-10-08T15:00:00.000Z", "confirmed", 500, true);      // sinal devolvido: conta o atendimento, não o dinheiro
  await booking("2026-10-07T15:00:00.000Z", "cancelled", 1000);           // cancelado: fora
  await booking("2026-10-05T02:30:00.000Z", "confirmed", 1000);           // dom 4 out 23:30 local: semana anterior, fora
  await booking("2026-10-12T03:30:00.000Z", "confirmed", 1000);           // seg 00:30 local: semana que vem
  await booking("2026-10-14T15:00:00.000Z", "confirmed", 1000);           // semana que vem
  await booking("2026-10-20T15:00:00.000Z", "confirmed", 1000);           // daqui a duas semanas: fora
});

afterEach(async () => {
  for (const id of [businessId, quietBusinessId]) {
    await database.delete(schema.ownerNotices).where(eq(schema.ownerNotices.businessId, id));
    await database.delete(schema.bookings).where(eq(schema.bookings.businessId, id));
    await database.delete(schema.customers).where(eq(schema.customers.businessId, id));
    await database.delete(schema.services).where(eq(schema.services.businessId, id));
    await database.delete(schema.businesses).where(eq(schema.businesses.id, id));
  }
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
  await database.delete(schema.user).where(eq(schema.user.id, unverifiedOwnerId));
});

afterAll(async () => {
  await pool.end();
});

describe("resumo semanal no banco", () => {
  it("conta a semana no fuso do negócio e ignora dono sem e-mail confirmado", async () => {
    const rows = await createDrizzleWeeklySummaryPorts(database).load(now);
    const mine = rows.find((row) => row.businessId === businessId);
    expect(mine).toEqual({
      businessId, businessName: "Studio Bella", ownerName: "Ana Souza", ownerEmail: `${ownerId}@example.com`,
      weekStart: "2026-10-05", bookings: 3, depositCents: 3000, newCustomers: 1, nextWeekBookings: 2,
    });
    expect(rows.some((row) => row.businessId === quietBusinessId)).toBe(false);
  });

  it("manda uma vez por semana, mesmo chamando o cron de novo", async () => {
    const send = vi.fn(async () => undefined);
    const ports = createDrizzleWeeklySummaryPorts(database, send);
    const onlyMine = { ...ports, load: async (at: Date) => (await ports.load(at)).filter((row) => row.businessId === businessId) };

    expect((await runWeeklySummaries(onlyMine, now)).weeklySummaries.sent).toBe(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: `${ownerId}@example.com`, subject: "Sua semana: R$ 30,00 em sinais pelo Pix" }));
    const [notice] = await database.select().from(schema.ownerNotices).where(eq(schema.ownerNotices.businessId, businessId));
    expect(notice.kind).toBe("weekly_summary:2026-10-05");
    expect(notice.emailSentAt).not.toBeNull();

    expect((await runWeeklySummaries(onlyMine, now)).weeklySummaries).toMatchObject({ sent: 0, skipped: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("e-mail que falha não deixa trava presa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ports = createDrizzleWeeklySummaryPorts(database, async () => { throw new Error("smtp down"); });
    const onlyMine = { ...ports, load: async (at: Date) => (await ports.load(at)).filter((row) => row.businessId === businessId) };
    expect((await runWeeklySummaries(onlyMine, now)).weeklySummaries.failed).toBe(1);
    expect(await database.select().from(schema.ownerNotices).where(eq(schema.ownerNotices.businessId, businessId))).toEqual([]);
  });
});
