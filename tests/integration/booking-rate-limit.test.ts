import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { getDb } from "../../db";
import { bookingRateLimits, businesses, user } from "../../db/schema";
import { bookingConfig } from "../../lib/bookings/config";
import { consumeBookingRateLimit, tenantScopedHash } from "../../lib/bookings/rate-limit";

const database = getDb();
afterAll(async () => database.$client.end());
let ownerId: string;
let ids: string[];
const bucket = (businessId: string, identity: string) => tenantScopedHash("booking-rate:v1", businessId, identity);
const attempts = async (businessId: string, identity: string) => (await database.select().from(bookingRateLimits)
  .where(and(eq(bookingRateLimits.businessId, businessId), eq(bookingRateLimits.clientHash, bucket(businessId, identity)))))[0]?.attempts ?? 0;
const settle = async (count: number, run: () => Promise<unknown>) => {
  const results = await Promise.allSettled(Array.from({ length: count }, run));
  for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ status: 429, code: "rate_limited" });
  return results.filter((result) => result.status === "fulfilled").length;
};

beforeEach(async () => {
  ownerId = randomUUID(); ids = [randomUUID(), randomUUID()];
  await database.insert(user).values({ id: ownerId, name: "Dono sintético", email: `${ownerId}@example.com` });
  for (const id of ids) await database.insert(businesses).values({ id, ownerId, name: "Rate fixture", slug: `rate-${id}` });
});
afterEach(async () => {
  for (const id of ids) await database.delete(businesses).where(eq(businesses.id, id));
  await database.delete(user).where(eq(user.id, ownerId));
});

it("limita tentativas concorrentes por cliente de forma atômica, reinicia janela vencida e isola negócio/cliente", async () => {
  expect(await settle(30, () => consumeBookingRateLimit(database, ids[0], "peer:192.0.2.1"))).toBe(10);
  expect(await attempts(ids[0], "peer:192.0.2.1")).toBe(10);
  // Tentativas recusadas pelo balde do cliente não consomem o teto do negócio.
  expect(await attempts(ids[0], "*business*")).toBe(10);
  const rows = await database.select().from(bookingRateLimits).where(eq(bookingRateLimits.businessId, ids[0]));
  for (const row of rows) expect(row.clientHash).not.toContain("192.0.2.1");
  await consumeBookingRateLimit(database, ids[1], "peer:192.0.2.1");
  await consumeBookingRateLimit(database, ids[0], "peer:192.0.2.2");
  await database.update(bookingRateLimits).set({ windowStartedAt: sql`now() - interval '2 minutes'` }).where(eq(bookingRateLimits.businessId, ids[0]));
  await consumeBookingRateLimit(database, ids[0], "peer:192.0.2.1");
  expect(await attempts(ids[0], "peer:192.0.2.1")).toBe(1);
});

it("um cliente sozinho não esgota o negócio: outros clientes seguem até o teto compartilhado", async () => {
  const config = bookingConfig({ BOOKING_RATE_LIMIT_PER_CLIENT: "5", BOOKING_RATE_LIMIT_PER_BUSINESS: "12" });
  expect(await settle(40, () => consumeBookingRateLimit(database, ids[0], "peer:198.51.100.1", config))).toBe(5);
  expect(await settle(5, () => consumeBookingRateLimit(database, ids[0], "peer:198.51.100.2", config))).toBe(5);
  // Teto do negócio (12) atingido após 2 tentativas do terceiro cliente.
  expect(await settle(5, () => consumeBookingRateLimit(database, ids[0], "peer:198.51.100.3", config))).toBe(2);
  expect(await attempts(ids[0], "*business*")).toBe(12);
  // Outro negócio não é afetado.
  await consumeBookingRateLimit(database, ids[1], "peer:198.51.100.3", config);
});

it("sem identidade confiável aplica só o teto do negócio, nunca um balde anônimo de 10", async () => {
  const config = bookingConfig({ BOOKING_RATE_LIMIT_PER_BUSINESS: "25" });
  expect(await settle(40, () => consumeBookingRateLimit(database, ids[0], null, config))).toBe(25);
  expect(await database.select().from(bookingRateLimits).where(eq(bookingRateLimits.businessId, ids[0]))).toHaveLength(1);
});
