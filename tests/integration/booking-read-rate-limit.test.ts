import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { getDb } from "../../db";
import { bookingRateLimits, businesses, user } from "../../db/schema";
import { bookingConfig } from "../../lib/bookings/config";
import { consumeBookingReadRateLimit, tenantScopedHash } from "../../lib/bookings/rate-limit";

const database = getDb();
afterAll(async () => database.$client.end());
let ownerId: string;
let ids: string[];
const bucket = (businessId: string, identity: string) => tenantScopedHash("booking-read-rate:v1", businessId, identity);
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

it("limita leituras públicas com limites maiores que criação", async () => {
  expect(await settle(100, () => consumeBookingReadRateLimit(database, ids[0], "peer:192.0.2.1"))).toBe(60);
  expect(await attempts(ids[0], "peer:192.0.2.1")).toBe(60);
  expect(await attempts(ids[0], "*business*")).toBe(60);
});

it("teto por negócio em leituras funciona independente", async () => {
  const config = bookingConfig({ BOOKING_RATE_LIMIT_READ_PER_CLIENT: "20", BOOKING_RATE_LIMIT_READ_PER_BUSINESS: "50" });
  expect(await settle(30, () => consumeBookingReadRateLimit(database, ids[0], "peer:198.51.100.1", config))).toBe(20);
  expect(await settle(30, () => consumeBookingReadRateLimit(database, ids[0], "peer:198.51.100.2", config))).toBe(20);
  expect(await settle(30, () => consumeBookingReadRateLimit(database, ids[0], "peer:198.51.100.3", config))).toBe(10);
  expect(await attempts(ids[0], "*business*")).toBe(50);
});

it("rate-limit de leitura não interfere com rate-limit de criação", async () => {
  const config = bookingConfig({ BOOKING_RATE_LIMIT_PER_CLIENT: "5", BOOKING_RATE_LIMIT_READ_PER_CLIENT: "20" });
  expect(await settle(30, () => consumeBookingReadRateLimit(database, ids[0], "peer:203.0.113.1", config))).toBe(20);
  const readBucket = tenantScopedHash("booking-read-rate:v1", ids[0], "peer:203.0.113.1");
  const writeBucket = tenantScopedHash("booking-rate:v1", ids[0], "peer:203.0.113.1");
  expect(readBucket).not.toBe(writeBucket);
  const rows = await database.select().from(bookingRateLimits).where(eq(bookingRateLimits.businessId, ids[0]));
  expect(rows.find((row) => row.clientHash === readBucket)?.attempts).toBe(20);
  expect(rows.find((row) => row.clientHash === writeBucket)).toBeUndefined();
});

it("janela de leitura reinicia após 1 minuto", async () => {
  const config = bookingConfig({ BOOKING_RATE_LIMIT_READ_PER_CLIENT: "15" });
  expect(await settle(20, () => consumeBookingReadRateLimit(database, ids[0], "peer:192.0.2.99", config))).toBe(15);
  await database.update(bookingRateLimits).set({ windowStartedAt: sql`now() - interval '2 minutes'` }).where(eq(bookingRateLimits.businessId, ids[0]));
  await consumeBookingReadRateLimit(database, ids[0], "peer:192.0.2.99", config);
  expect(await attempts(ids[0], "peer:192.0.2.99")).toBe(1);
});
