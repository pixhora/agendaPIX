import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { getDb } from "../../db";
import { businesses, user } from "../../db/schema";
import { resumeOwnedBusiness } from "../../lib/onboarding/resume";

const db = getDb();
afterAll(() => db.$client.end());

it("devolve o negócio mais recente do dono da sessão, nunca o de outro", async () => {
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const olderSlug = `resume-old-${ownerA.slice(0, 8)}`;
  const newerSlug = `resume-new-${ownerA.slice(0, 8)}`;
  const foreignSlug = `resume-out-${ownerB.slice(0, 8)}`;
  await db.insert(user).values([
    { id: ownerA, name: "Ana", email: `${ownerA}@example.com` },
    { id: ownerB, name: "Bia", email: `${ownerB}@example.com` },
  ]);
  try {
    await db.insert(businesses).values({
      ownerId: ownerA,
      name: "Antigo",
      slug: olderSlug,
      timezone: "America/Sao_Paulo",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const [newer] = await db.insert(businesses).values({
      ownerId: ownerA,
      name: "Novo",
      slug: newerSlug,
      timezone: "America/Sao_Paulo",
    }).returning({ id: businesses.id });
    const [foreign] = await db.insert(businesses).values({
      ownerId: ownerB,
      name: "Outro",
      slug: foreignSlug,
      timezone: "America/Sao_Paulo",
    }).returning({ id: businesses.id });
    await expect(resumeOwnedBusiness(ownerA, db)).resolves.toEqual({
      businessId: newer.id,
      slug: newerSlug,
      publicPath: `/${newerSlug}`,
    });
    const other = await resumeOwnedBusiness(ownerB, db);
    expect(other?.businessId).toBe(foreign.id);
    expect(other?.businessId).not.toBe(newer.id);
    await expect(resumeOwnedBusiness(randomUUID(), db)).resolves.toBeNull();
  } finally {
    await db.delete(businesses).where(inArray(businesses.ownerId, [ownerA, ownerB]));
    await db.delete(user).where(inArray(user.id, [ownerA, ownerB]));
  }
});
