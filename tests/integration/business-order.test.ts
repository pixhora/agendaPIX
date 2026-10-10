import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { getDb } from "../../db";
import { businesses, businessSlugHistory, user } from "../../db/schema";
import { ownedBusinesses } from "../../lib/dashboard/data";

const db = getDb();
afterAll(() => db.$client.end());

it("lists the owner's newest business first, so the newest one is the default in the panel", async () => {
  const ownerId = randomUUID();
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  await db.insert(user).values({ id: ownerId, name: "Dono", email: `${ownerId}@example.com` });
  try {
    const older = await db.insert(businesses).values({
      ownerId, name: "Achadinhos", slug: `achadinhos-${token}`, createdAt: new Date("2026-01-01T10:00:00Z"),
    }).returning({ id: businesses.id });
    const newer = await db.insert(businesses).values({
      ownerId, name: "Frajola", slug: `frajola-${token}`, createdAt: new Date("2026-02-01T10:00:00Z"),
    }).returning({ id: businesses.id });
    const rows = await ownedBusinesses(ownerId, db);
    expect(rows.map((row) => row.name)).toEqual(["Frajola", "Achadinhos"]);
    expect(rows[0]?.id).toBe(newer[0]?.id);
    expect(rows[1]?.id).toBe(older[0]?.id);
  } finally {
    const rows = await db.select({ id: businesses.id }).from(businesses).where(inArray(businesses.ownerId, [ownerId]));
    const ids = rows.map((row) => row.id);
    if (ids.length) await db.delete(businessSlugHistory).where(inArray(businessSlugHistory.businessId, ids));
    await db.delete(businesses).where(inArray(businesses.ownerId, [ownerId]));
    await db.delete(user).where(inArray(user.id, [ownerId]));
  }
});
