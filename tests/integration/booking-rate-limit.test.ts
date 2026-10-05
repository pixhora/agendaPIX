import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { getDb } from "../../db";
import { bookingRateLimits, businesses, user } from "../../db/schema";
import { consumeBookingRateLimit } from "../../lib/bookings/rate-limit";

const database = getDb();
afterAll(async () => database.$client.end());

it("atomically limits concurrent attempts, resets expired windows and isolates tenant/client", async () => {
  const ownerId = randomUUID();
  const ids = [randomUUID(), randomUUID()];
  await database.insert(user).values({ id: ownerId, name: "Dono sintético", email: `${ownerId}@example.com` });
  try {
    for (const id of ids) await database.insert(businesses).values({ id, ownerId, name: "Rate fixture", slug: `rate-${id}` });
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => consumeBookingRateLimit(database, ids[0], "192.0.2.1")));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(10);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(20);
    for (const result of results) if (result.status === "rejected") expect(result.reason.status).toBe(429);
    const [row] = await database.select().from(bookingRateLimits).where(eq(bookingRateLimits.businessId, ids[0]));
    expect(row.attempts).toBe(10);
    expect(row.clientHash).not.toContain("192.0.2.1");
    await consumeBookingRateLimit(database, ids[1], "192.0.2.1");
    await consumeBookingRateLimit(database, ids[0], "192.0.2.2");
    await database.update(bookingRateLimits).set({ windowStartedAt: sql`now() - interval '2 minutes'` }).where(eq(bookingRateLimits.businessId, ids[0]));
    await consumeBookingRateLimit(database, ids[0], "192.0.2.1");
    const rows = await database.select().from(bookingRateLimits).where(eq(bookingRateLimits.businessId, ids[0]));
    expect(rows.find((value) => value.clientHash === row.clientHash)?.attempts).toBe(1);
  } finally {
    for (const id of ids) await database.delete(businesses).where(eq(businesses.id, id));
    await database.delete(user).where(eq(user.id, ownerId));
  }
});
