import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { inArray } from "drizzle-orm";
import { afterAll, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { businesses, businessSlugHistory, services, user } from "../../db/schema";
import { LOGO_UPLOAD_FIELD } from "../../lib/contracts";
import { createFakeBlobStore } from "../../lib/business-profile/logo-store";
import { uploadServiceImage } from "../../lib/business-profile/service-image";
import { listPublicServices } from "../../lib/bookings/service";
import { HttpError } from "../../lib/http";

vi.mock("next/cache", () => ({
  revalidateTag: () => undefined,
  unstable_cache: (load: () => Promise<unknown>) => load,
}));

const db = getDb();
afterAll(() => db.$client.end());

async function createOwner(name: string) {
  const id = randomUUID();
  await db.insert(user).values({ id, name, email: `${id}@example.com` });
  return id;
}

async function createBusinessWithService(ownerId: string, slug: string) {
  const [business] = await db.insert(businesses).values({ ownerId, name: "Loja da foto", slug }).returning();
  const [service] = await db.insert(services).values({
    businessId: business!.id,
    name: "Corte",
    durationMinutes: 30,
    priceCents: 5000,
    depositCents: 0,
  }).returning();
  return { business: business!, service: service! };
}

async function cleanup(ownerIds: string[]) {
  if (!ownerIds.length) return;
  const rows = await db.select({ id: businesses.id }).from(businesses).where(inArray(businesses.ownerId, ownerIds));
  const ids = rows.map((row) => row.id);
  if (ids.length) {
    await db.delete(services).where(inArray(services.businessId, ids));
    await db.delete(businessSlugHistory).where(inArray(businessSlugHistory.businessId, ids));
  }
  await db.delete(businesses).where(inArray(businesses.ownerId, ownerIds));
  await db.delete(user).where(inArray(user.id, ownerIds));
}

async function photoRequest() {
  const big = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg({ quality: 95 }).toBuffer();
  const form = new FormData();
  form.append(LOGO_UPLOAD_FIELD, new File([new Uint8Array(big)], "foto.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost:3000/api/businesses/x/services/y/image", { method: "POST", body: form });
}

it("stores a service photo, shows it in the public list, replaces it and deletes only our previous file", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const ownerId = await createOwner("Foto");
  const { business, service } = await createBusinessWithService(ownerId, `foto-${token}`);
  try {
    let n = 0;
    const store = createFakeBlobStore(() => `s${n += 1}`);
    const first = await uploadServiceImage(business.id, service.id, ownerId, await photoRequest(), db, store);
    expect(first.logoUrl).toBe(`https://blob.fake.local/services/${service.id}-s1.webp`);

    const catalog = await listPublicServices(`foto-${token}`, db);
    expect(catalog.services.find((item) => item.id === service.id)?.imageUrl).toBe(first.logoUrl);

    const deleted: string[] = [];
    const tracking = { put: store.put, del: async (url: string) => { deleted.push(url); } };
    const second = await uploadServiceImage(business.id, service.id, ownerId, await photoRequest(), db, tracking);
    expect(second.logoUrl).toBe(`https://blob.fake.local/services/${service.id}-s2.webp`);
    expect(deleted).toEqual([first.logoUrl]);
  } finally {
    await cleanup([ownerId]);
  }
});

it("refuses a photo for a service the owner does not have, and for another owner's business", async () => {
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const ownerId = await createOwner("Dono");
  const intruderId = await createOwner("Intruso");
  const { business, service } = await createBusinessWithService(ownerId, `dono-${token}`);
  try {
    const store = createFakeBlobStore(() => "x");
    await expect(uploadServiceImage(business.id, randomUUID(), ownerId, await photoRequest(), db, store)).rejects.toMatchObject({ status: 404 });
    await expect(uploadServiceImage(business.id, service.id, intruderId, await photoRequest(), db, store)).rejects.toBeInstanceOf(HttpError);
    const [row] = await db.select({ imageUrl: services.imageUrl }).from(services);
    expect(row?.imageUrl).toBeNull();
  } finally {
    await cleanup([ownerId, intruderId]);
  }
});
