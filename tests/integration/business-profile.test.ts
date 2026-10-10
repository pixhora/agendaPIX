import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { getDb } from "../../db";
import { businesses, businessSlugHistory, user } from "../../db/schema";
import { GET as paymentGet } from "../../app/api/public/[slug]/bookings/[id]/payment/route";
import { GET as servicesGet } from "../../app/api/public/[slug]/services/route";
import { createFakeBlobStore, saveBusinessLogo } from "../../lib/business-profile/logo-store";
import { updateBusinessProfile } from "../../lib/business-profile/update";
import { HttpError } from "../../lib/http";
import { slugAvailability } from "../../lib/slug-availability";

const db = getDb();
afterAll(() => db.$client.end());

async function createOwner(name: string) {
  const id = randomUUID();
  await db.insert(user).values({ id, name, email: `${id}@example.com` });
  return id;
}

async function createBusiness(ownerId: string, slug: string, name = "Loja") {
  const [row] = await db.insert(businesses).values({ ownerId, name, slug }).returning();
  return row;
}

async function cleanup(ownerIds: string[]) {
  if (!ownerIds.length) return;
  const rows = await db.select({ id: businesses.id }).from(businesses).where(inArray(businesses.ownerId, ownerIds));
  const ids = rows.map((row) => row.id);
  if (ids.length) await db.delete(businessSlugHistory).where(inArray(businessSlugHistory.businessId, ids));
  await db.delete(businesses).where(inArray(businesses.ownerId, ownerIds));
  await db.delete(user).where(inArray(user.id, ownerIds));
}

it("returns 409 when two owners take the same slug, and 308 from the old public routes", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const target = `alvo-${token}`;
  const owners = [await createOwner("Um"), await createOwner("Dois")];
  const first = await createBusiness(owners[0], `um-${token}`);
  const second = await createBusiness(owners[1], `dois-${token}`);
  try {
    const outcomes = await Promise.all([first, second].map(async (business, index) => {
      try {
        return { ok: true as const, value: await updateBusinessProfile(business.id, owners[index], { slug: target }, db) };
      } catch (error) {
        if (error instanceof HttpError) return { ok: false as const, error };
        throw error;
      }
    }));
    const won = outcomes.filter((item) => item.ok);
    const lost = outcomes.filter((item) => !item.ok);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    if (!won[0].ok || lost[0].ok) throw new Error("race result");
    expect(lost[0].error).toMatchObject({ status: 409, code: "slug_taken" });
    expect(won[0].value.slug).toBe(target);
    expect(won[0].value.publicPath).toBe(`/${target}`);

    const oldSlug = won[0].value.id === first.id ? first.slug : second.slug;
    const services = await servicesGet(new Request(`http://localhost:3000/api/public/${oldSlug}/services?dia=1`), {
      params: Promise.resolve({ slug: oldSlug }),
    });
    expect(services.status).toBe(308);
    expect(services.headers.get("location")).toBe(`/api/public/${target}/services?dia=1`);
    expect(services.headers.get("cache-control")).toBe("no-store");

    const bookingId = "11111111-1111-4111-8111-111111111111";
    const payment = await paymentGet(new Request(`http://localhost:3000/api/public/${oldSlug}/bookings/${bookingId}/payment?x=1`), {
      params: Promise.resolve({ slug: oldSlug, id: bookingId }),
    });
    expect(payment.status).toBe(308);
    expect(payment.headers.get("location")).toBe(`/api/public/${target}/bookings/${bookingId}/payment?x=1`);
    expect(payment.headers.get("cache-control")).toBe("no-store");
  } finally {
    await cleanup(owners);
  }
});

it("lets the owner reclaim an alias, blocks another owner, and skips that alias in suggestions", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const alias = `s${token}-lash`;
  const current = `k${token}`;
  const owners = [await createOwner("Dono"), await createOwner("Outro")];
  const business = await createBusiness(owners[0], alias, "Cílios");
  const other = await createBusiness(owners[1], `o${token}`, "Outra");
  try {
    const renamed = await updateBusinessProfile(business.id, owners[0], { name: "Cílios novo", slug: current }, db);
    expect(renamed).toMatchObject({ name: "Cílios novo", slug: current, publicPath: `/${current}` });
    expect(renamed.publicUrl).toMatch(new RegExp(`/${current}$`));
    const history = await db.select().from(businessSlugHistory).where(eq(businessSlugHistory.businessId, business.id));
    expect(history.map((row) => row.oldSlug)).toEqual([alias]);

    const named = await updateBusinessProfile(business.id, owners[0], { name: "Só o nome" }, db);
    expect(named.name).toBe("Só o nome");
    expect(await db.select().from(businessSlugHistory).where(eq(businessSlugHistory.businessId, business.id))).toHaveLength(1);

    const requested = `s${token}`;
    await createBusiness(owners[1], requested, "Pedido");
    const availability = await slugAvailability(requested, { segment: "cilios" }, db);
    expect(availability).toMatchObject({ available: false, reason: "taken" });
    expect(availability.suggestions).not.toContain(alias);
    expect(availability.suggestions[0]).toBe(`${requested}-2`);
    const aliasCheck = await slugAvailability(alias, { segment: "cilios" }, db);
    expect(aliasCheck).toMatchObject({ available: false, reason: "taken" });

    await expect(updateBusinessProfile(other.id, owners[1], { slug: alias }, db)).rejects.toMatchObject({
      status: 409,
      code: "slug_taken",
      details: { details: { constraint: "slug_alias" } },
    });

    const reclaimed = await updateBusinessProfile(business.id, owners[0], { slug: alias }, db);
    expect(reclaimed.slug).toBe(alias);
    const after = await db.select().from(businessSlugHistory).where(eq(businessSlugHistory.businessId, business.id));
    expect(after.map((row) => row.oldSlug)).toEqual([current]);
  } finally {
    await cleanup(owners);
  }
});

it("stores a re-encoded logo with the fake adapter and leaves the public services payload with that url", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const ownerId = await createOwner("Logo");
  const business = await createBusiness(ownerId, `logo-${token}`);
  try {
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 9, g: 8, b: 7 } } }).png().toBuffer();
    const saved = await saveBusinessLogo(business.id, ownerId, png, db, createFakeBlobStore(() => "abc123"));
    expect(saved.logoUrl).toBe(`https://blob.fake.local/logos/${business.id}-abc123.webp`);
    const [row] = await db.select({ logoUrl: businesses.logoUrl }).from(businesses).where(eq(businesses.id, business.id));
    expect(row?.logoUrl).toBe(saved.logoUrl);

    const response = await servicesGet(new Request(`http://localhost:3000/api/public/logo-${token}/services`), {
      params: Promise.resolve({ slug: `logo-${token}` }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { logoUrl: string | null };
    expect(body.logoUrl).toBe(saved.logoUrl);
  } finally {
    await cleanup([ownerId]);
  }
});
