import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { getDb } from "../../db";
import { businesses, businessHours, onboardingRequests, services, user } from "../../db/schema";
import { provisionBusiness } from "../../lib/onboarding/service";
const db = getDb();
afterAll(() => db.$client.end());
it("provisions atomically, replays concurrent requests and isolates owners and slug conflicts", async () => {
  const owners = [randomUUID(), randomUUID()];
  const key = randomUUID();
  const slug = `onb-${key.replaceAll("-", "").slice(0, 16)}`;
  const input = { business: { name: "Fixture", slug, timezone: "America/Sao_Paulo" }, service: { name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 }, hours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00" }] };
  await db.insert(user).values(owners.map(id => ({ id, name: "Fixture", email: `${id}@example.com` })));
  try {
    const results = await Promise.all(Array.from({ length: 5 }, () => provisionBusiness(owners[0], key, input, db)));
    expect(results.filter(value => !value.replay)).toHaveLength(1);
    expect(new Set(results.map(value => value.result.businessId)).size).toBe(1);
    await expect(provisionBusiness(owners[0], key, { ...input, business: { ...input.business, name: "Changed" } }, db)).rejects.toMatchObject({ status: 409, code: "idempotency_conflict" });
    const taken = await provisionBusiness(owners[1], key, input, db).then(() => null, (error: unknown) => error);
    expect(taken).toMatchObject({
      status: 409,
      code: "slug_taken",
      details: { details: { constraint: "businesses_slug_unique" } },
    });
    const suggestions = (taken as { details?: { details?: { suggestions?: unknown } } }).details?.details?.suggestions;
    expect(Array.isArray(suggestions) && suggestions.length > 0 && suggestions.length <= 3).toBe(true);
    expect(suggestions).not.toContain(slug);
    expect(await db.select().from(onboardingRequests).where(eq(onboardingRequests.ownerId, owners[1]))).toHaveLength(0);
    const second = await provisionBusiness(owners[1], key, { ...input, business: { ...input.business, slug: `oth-${key.replaceAll("-", "").slice(0, 16)}` } }, db);
    expect(second.result.businessId).not.toBe(results[0].result.businessId);
    expect(await db.select().from(businessHours).where(eq(businessHours.businessId, results[0].result.businessId))).toHaveLength(1);
    const [created] = await db.select({ logoUrl: businesses.logoUrl }).from(businesses).where(eq(businesses.id, results[0].result.businessId));
    expect(created?.logoUrl).toBeNull();
    await expect(provisionBusiness(owners[1], randomUUID(), {
      ...input,
      business: { ...input.business, logoUrl: "https://attacker-store.public.blob.vercel-storage.com/evil.png" },
    }, db)).rejects.toMatchObject({ status: 400, code: "invalid_input" });
  } finally {
    await db.delete(onboardingRequests).where(inArray(onboardingRequests.ownerId, owners));
    const rows = await db.select().from(businesses).where(inArray(businesses.ownerId, owners));
    for (const row of rows) {
      await db.delete(businessHours).where(eq(businessHours.businessId, row.id));
      await db.delete(services).where(eq(services.businessId, row.id));
    }
    await db.delete(businesses).where(inArray(businesses.ownerId, owners));
    await db.delete(user).where(inArray(user.id, owners));
  }
});
