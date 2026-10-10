import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { afterAll, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { businesses, businessHours, businessSlugHistory, services, user } from "../../db/schema";
import { GET as paymentGet } from "../../app/api/public/[slug]/bookings/[id]/payment/route";
import { GET as servicesGet } from "../../app/api/public/[slug]/services/route";
import { consumeAbuseBucket } from "../../lib/abuse-rate-limit";
import { SlugMoved } from "../../lib/business-profile/public-slug";
import { createFakeBlobStore, LOGO_REQUEST_MAX_BYTES, saveBusinessLogo, uploadBusinessLogo } from "../../lib/business-profile/logo-store";
import { PROFILE_PATCH_LIMIT } from "../../lib/business-profile/slug-policy";
import { updateBusinessProfile } from "../../lib/business-profile/update";
import { getAvailability, listPublicServices } from "../../lib/bookings/service";
import { loadPublicCatalog } from "../../lib/bookings/public-catalog";
import { HttpError } from "../../lib/http";
import { slugAvailability } from "../../lib/slug-availability";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache: (load: () => Promise<unknown>) => load,
}));

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
    const raceSuggestions = (lost[0].error.details?.details as { suggestions?: string[] } | undefined)?.suggestions ?? [];
    expect(raceSuggestions.length).toBeGreaterThan(0);
    expect(raceSuggestions.length).toBeLessThanOrEqual(3);
    expect(raceSuggestions).not.toContain(target);
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

    const denied = await updateBusinessProfile(other.id, owners[1], { slug: alias }, db).then(() => null, (error: unknown) => error);
    expect(denied).toMatchObject({
      status: 409,
      code: "slug_taken",
      details: { details: { constraint: "slug_alias" } },
    });
    const offered = ((denied as HttpError).details?.details as { suggestions?: string[] } | undefined)?.suggestions ?? [];
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.length).toBeLessThanOrEqual(3);
    expect(offered).not.toContain(alias);

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

it("rejects logoUrl on PATCH and deletes only a previous logo from our store", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const ownerId = await createOwner("Logo patch");
  const business = await createBusiness(ownerId, `logo-patch-${token}`);
  try {
    await expect(updateBusinessProfile(business.id, ownerId, {
      name: "Não grava",
      logoUrl: "https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/logos/x.webp",
    }, db)).rejects.toMatchObject({ status: 400, code: "invalid_input" });
    const [unchanged] = await db.select({ name: businesses.name, logoUrl: businesses.logoUrl }).from(businesses).where(eq(businesses.id, business.id));
    expect(unchanged).toMatchObject({ name: "Loja", logoUrl: null });

    const deleted: string[] = [];
    let n = 0;
    const base = createFakeBlobStore(() => `f${n += 1}`);
    const store = {
      put: base.put.bind(base),
      async del(url: string) { deleted.push(url); },
    };
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    const first = await saveBusinessLogo(business.id, ownerId, png, db, store);
    expect(deleted).toEqual([]);
    const second = await saveBusinessLogo(business.id, ownerId, png, db, store);
    expect(deleted).toEqual([first.logoUrl]);
    expect(second.logoUrl).not.toBe(first.logoUrl);

    await db.update(businesses).set({ logoUrl: `https://evil.example/logos/${business.id}/fora.webp` }).where(eq(businesses.id, business.id));
    deleted.length = 0;
    const foreign = await saveBusinessLogo(business.id, ownerId, png, db, store);
    expect(deleted).toEqual([]);
    expect(foreign.logoUrl).toMatch(/^https:\/\/blob\.fake\.local\/logos\//);

    const throwing = {
      put: base.put.bind(base),
      async del() { throw new Error("blob down"); },
    };
    const kept = await saveBusinessLogo(business.id, ownerId, png, db, throwing);
    expect(kept.logoUrl).toMatch(/^https:\/\/blob\.fake\.local\/logos\//);
  } finally {
    await cleanup([ownerId]);
  }
});

it("rejects an oversized logo before reading the body and while streaming", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const ownerId = await createOwner("Logo tamanho");
  const business = await createBusiness(ownerId, `logo-size-${token}`);
  try {
    let pulled = false;
    const early = {
      url: "https://agenda.example/logo",
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=----x",
        "content-length": String(LOGO_REQUEST_MAX_BYTES + 1),
      }),
      body: {
        getReader() {
          pulled = true;
          throw new Error("should not read");
        },
      },
    } as unknown as Request;
    await expect(uploadBusinessLogo(business.id, ownerId, early, db, createFakeBlobStore())).rejects.toMatchObject({
      status: 413,
      code: "logo_too_large",
    });
    expect(pulled).toBe(false);

    const chunk = new Uint8Array(64 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > LOGO_REQUEST_MAX_BYTES) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
        sent += chunk.byteLength;
      },
    });
    const request = new Request("https://agenda.example/logo", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=----x" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(uploadBusinessLogo(business.id, ownerId, request, db, createFakeBlobStore())).rejects.toMatchObject({
      status: 413,
      code: "logo_too_large",
    });
  } finally {
    await cleanup([ownerId]);
  }
});

it("limits slug changes to 3 per 30 days and still limits every profile save", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const ownerId = await createOwner("Limite");
  const business = await createBusiness(ownerId, `s${token}0`);
  try {
    for (const suffix of ["a", "b", "c"]) {
      const saved = await updateBusinessProfile(business.id, ownerId, { slug: `s${token}${suffix}` }, db);
      expect(saved.slug).toBe(`s${token}${suffix}`);
    }
    try {
      await updateBusinessProfile(business.id, ownerId, { slug: `s${token}d` }, db);
      throw new Error("expected rate limit");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const http = error as HttpError;
      expect(http.status).toBe(429);
      expect(http.code).toBe("rate_limited");
      expect(http.retryAfterSeconds).toBeGreaterThan(0);
    }
    const named = await updateBusinessProfile(business.id, ownerId, { name: "Ainda dá" }, db);
    expect(named.name).toBe("Ainda dá");
    expect(named.slug).toBe(`s${token}c`);

    const limitedOwner = await createOwner("Teto");
    const limited = await createBusiness(limitedOwner, `cap${token}`);
    try {
      for (let attempt = 0; attempt < PROFILE_PATCH_LIMIT; attempt += 1) {
        await consumeAbuseBucket("profile-patch", limitedOwner, PROFILE_PATCH_LIMIT, "hour", db);
      }
      await expect(updateBusinessProfile(limited.id, limitedOwner, { name: "Parou" }, db)).rejects.toMatchObject({
        status: 429,
        code: "rate_limited",
      });
    } finally {
      await cleanup([limitedOwner]);
    }
  } finally {
    await cleanup([ownerId]);
  }
});

it("releases the oldest alias, stops its redirect, and blocks other businesses for 90 days", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const owners = [await createOwner("Alias"), await createOwner("Vizinho")];
  const current = `cur${token}`;
  const next = `nxt${token}`;
  const aliases = [`a${token}`, `b${token}`, `c${token}`];
  const business = await createBusiness(owners[0], current, "Origem");
  const other = await createBusiness(owners[1], `oth${token}`, "Outra");
  try {
    for (const [index, oldSlug] of aliases.entries()) {
      await db.insert(businessSlugHistory).values({
        oldSlug,
        businessId: business.id,
        createdAt: new Date(Date.now() - (40 - index) * 24 * 60 * 60 * 1000),
      });
    }
    const saved = await updateBusinessProfile(business.id, owners[0], { slug: next }, db);
    expect(saved.slug).toBe(next);
    const rows = await db.select().from(businessSlugHistory).where(eq(businessSlugHistory.businessId, business.id));
    const released = rows.find((row) => row.oldSlug === aliases[0]);
    expect(released?.releasedAt).toBeInstanceOf(Date);
    expect(rows.filter((row) => row.releasedAt == null).map((row) => row.oldSlug).sort()).toEqual([aliases[1], aliases[2], current].sort());

    const active = await servicesGet(new Request(`http://localhost:3000/api/public/${aliases[1]}/services?dia=1`), {
      params: Promise.resolve({ slug: aliases[1] }),
    });
    expect(active.status).toBe(308);
    expect(active.headers.get("location")).toBe(`/api/public/${next}/services?dia=1`);

    const gone = await servicesGet(new Request(`http://localhost:3000/api/public/${aliases[0]}/services`), {
      params: Promise.resolve({ slug: aliases[0] }),
    });
    expect(gone.status).toBe(404);
    expect(await gone.json()).toMatchObject({ error: { code: "business_not_found" } });

    await expect(updateBusinessProfile(other.id, owners[1], { slug: aliases[0] }, db)).rejects.toMatchObject({
      status: 409,
      code: "slug_taken",
      details: { details: { constraint: "slug_alias" } },
    });
    expect(await slugAvailability(aliases[0], {}, db)).toMatchObject({ available: false, reason: "taken" });

    const reclaimed = await updateBusinessProfile(business.id, owners[0], { slug: aliases[0] }, db);
    expect(reclaimed.slug).toBe(aliases[0]);
    const activeLeft = await db.select({ oldSlug: businessSlugHistory.oldSlug }).from(businessSlugHistory).where(and(
      eq(businessSlugHistory.businessId, business.id),
      isNull(businessSlugHistory.releasedAt),
    ));
    expect(activeLeft).toHaveLength(3);
  } finally {
    await cleanup(owners);
  }
});

it("keeps the old slug as a 308 from the catalog, returns the stored logo, and drops both catalog tags", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const ownerId = await createOwner("Catálogo");
  const oldSlug = `velho-${token}`;
  const nextSlug = `novo-${token}`;
  const business = await createBusiness(ownerId, oldSlug, "Estúdio");
  try {
    await db.insert(services).values([
      { businessId: business.id, name: "Zeta", durationMinutes: 30, priceCents: 5000, depositCents: 0 },
      { businessId: business.id, name: "Alfa", durationMinutes: 45, priceCents: 8000, depositCents: 0 },
    ]);
    await db.insert(businessHours).values([
      { businessId: business.id, weekday: 3, opensAt: "09:00:00", closesAt: "18:00:00" },
      { businessId: business.id, weekday: 1, opensAt: "09:00:00", closesAt: "18:00:00" },
    ]);
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 4, g: 5, b: 6 } } }).png().toBuffer();
    const saved = await saveBusinessLogo(business.id, ownerId, png, db, createFakeBlobStore(() => "logo1"));
    const listed = await listPublicServices(oldSlug, db);
    expect(listed.logoUrl).toBe(saved.logoUrl);
    const catalog = await loadPublicCatalog(oldSlug, db);
    expect(catalog.services.map((service) => service.name)).toEqual(["Alfa", "Zeta"]);
    expect(catalog.hours.map((hour) => hour.weekday)).toEqual([1, 3]);

    process.env.NEXT_RUNTIME = "nodejs";
    revalidateTag.mockClear();
    const renamed = await updateBusinessProfile(business.id, ownerId, { name: "Estúdio novo", slug: nextSlug }, db);
    expect(renamed.slug).toBe(nextSlug);
    expect(revalidateTag).toHaveBeenCalledWith(`public-catalog:${oldSlug}`, { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(`public-catalog:${nextSlug}`, { expire: 0 });
    await expect(listPublicServices(oldSlug, db)).rejects.toBeInstanceOf(SlugMoved);
    await expect(getAvailability(oldSlug, {
      serviceId: "11111111-1111-4111-8111-111111111111",
      date: "2030-01-06",
    }, db)).rejects.toBeInstanceOf(SlugMoved);
    expect((await listPublicServices(nextSlug, db)).logoUrl).toBe(saved.logoUrl);

    revalidateTag.mockClear();
    const replaced = await saveBusinessLogo(business.id, ownerId, png, db, createFakeBlobStore(() => "logo2"));
    expect(revalidateTag).toHaveBeenCalledWith(`public-catalog:${nextSlug}`, { expire: 0 });
    expect((await listPublicServices(nextSlug, db)).logoUrl).toBe(replaced.logoUrl);
  } finally {
    delete process.env.NEXT_RUNTIME;
    await db.delete(services).where(eq(services.businessId, business.id));
    await db.delete(businessHours).where(eq(businessHours.businessId, business.id));
    await cleanup([ownerId]);
  }
});

it("lets another business take a released alias after 90 days", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const owners = [await createOwner("Velho"), await createOwner("Novo")];
  const freed = `old${token}`;
  const origin = await createBusiness(owners[0], `now${token}`);
  const other = await createBusiness(owners[1], `new${token}`);
  try {
    await db.insert(businessSlugHistory).values({ oldSlug: freed, businessId: origin.id });
    await db.execute(sql`UPDATE business_slug_history SET released_at = now() - interval '91 days' WHERE old_slug = ${freed}`);
    expect(await slugAvailability(freed, {}, db)).toMatchObject({ available: true, reason: null });
    const taken = await updateBusinessProfile(other.id, owners[1], { slug: freed }, db);
    expect(taken.slug).toBe(freed);
    const leftover = await db.select().from(businessSlugHistory).where(eq(businessSlugHistory.oldSlug, freed));
    expect(leftover).toHaveLength(0);
  } finally {
    await cleanup(owners);
  }
});
