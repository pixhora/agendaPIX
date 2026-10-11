import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { businesses, mercadopagoConnections, user } from "../../db/schema";
import { GET } from "../../app/api/onboarding/resume/route";
import { resumeOwnedBusiness } from "../../lib/onboarding/resume";
import { connectedMercadoPagoValues } from "../helpers/connected-mp";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));

vi.mock("../../lib/auth", () => ({
  getAuth: () => ({ api: { getSession: () => mocks.session() } }),
}));

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
    const ownerCpf = "52998224725";
    const foreignCpf = "39053344705";
    const ownerToken = "APP_USR-oauth-sentinel-owner-a";
    const foreignToken = "APP_USR-oauth-sentinel-owner-b";
    const oauthCode = "oauth-code-sentinel";
    const oauthState = "oauth-state-sentinel";
    await db.insert(businesses).values({
      ownerId: ownerA,
      name: "Antigo",
      slug: olderSlug,
      timezone: "America/Sao_Paulo",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const [newer] = await db.insert(businesses).values({
      ownerId: ownerA,
      name: ownerCpf,
      slug: newerSlug,
      timezone: "America/Sao_Paulo",
    }).returning({ id: businesses.id });
    const [foreign] = await db.insert(businesses).values({
      ownerId: ownerB,
      name: foreignCpf,
      slug: foreignSlug,
      timezone: "America/Sao_Paulo",
    }).returning({ id: businesses.id });
    await db.insert(mercadopagoConnections).values([
      { ...connectedMercadoPagoValues(newer.id), accessTokenEnc: ownerToken, mpUserId: `mp-${newer.id}` },
      { ...connectedMercadoPagoValues(foreign.id), accessTokenEnc: foreignToken, mpUserId: `mp-${foreign.id}` },
    ]);
    await expect(resumeOwnedBusiness(ownerA, db)).resolves.toEqual({
      businessId: newer.id,
      slug: newerSlug,
      publicPath: `/${newerSlug}`,
    });
    const other = await resumeOwnedBusiness(ownerB, db);
    expect(other?.businessId).toBe(foreign.id);
    expect(other?.businessId).not.toBe(newer.id);
    await expect(resumeOwnedBusiness(randomUUID(), db)).resolves.toBeNull();

    mocks.session.mockResolvedValue({ user: { id: ownerA, email: `${ownerA}@example.com` } });
    const foreignRead = await GET(new Request(`http://127.0.0.1:3344/api/onboarding/resume?businessId=${foreign.id}&slug=${foreignSlug}&code=${oauthCode}&state=${oauthState}`));
    expect(foreignRead.status).toBe(404);
    const foreignBody = await foreignRead.text();
    for (const secret of [foreign.id, foreignSlug, foreignCpf, foreignToken, ownerToken, ownerCpf, oauthCode, oauthState]) {
      expect(foreignBody).not.toContain(secret);
    }

    const own = await GET(new Request(`http://127.0.0.1:3344/api/onboarding/resume?code=${oauthCode}&state=${oauthState}`));
    expect(own.status).toBe(200);
    const ownBody = await own.json() as Record<string, unknown>;
    expect(ownBody).toEqual({ businessId: newer.id, slug: newerSlug, publicPath: `/${newerSlug}` });
    expect(Object.keys(ownBody).sort()).toEqual(["businessId", "publicPath", "slug"]);
    const ownText = JSON.stringify(ownBody);
    for (const secret of [ownerCpf, foreignCpf, ownerToken, foreignToken, oauthCode, oauthState]) {
      expect(ownText).not.toContain(secret);
    }
  } finally {
    const owned = await db.select({ id: businesses.id }).from(businesses).where(inArray(businesses.ownerId, [ownerA, ownerB]));
    if (owned.length > 0) {
      await db.delete(mercadopagoConnections).where(inArray(mercadopagoConnections.businessId, owned.map((row) => row.id)));
    }
    await db.delete(businesses).where(inArray(businesses.ownerId, [ownerA, ownerB]));
    await db.delete(user).where(inArray(user.id, [ownerA, ownerB]));
  }
});
