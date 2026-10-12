import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../app/og/slot-link/[previewId]/route";
import * as schema from "../../db/schema";
import { createSlotLink, readSlotLinkOgCard } from "../../lib/bookings/slot-link";
import { createSlotLinkPreviewId } from "../../lib/bookings/slot-link-token";
import { databaseEnvSchema } from "../../lib/env";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const DATE = "2030-01-01";
const CUSTOMER_NAME = "Joana Paga Sigilosa";
const CUSTOMER_PHONE = "+5511988776655";
const OWNER_LABEL = "Maria Secreta";
const PAID_CENTS = 4321;

const clock = (index: number) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

type Shop = { ownerId: string; businessId: string; slug: string; serviceId: string };

async function seedShop(): Promise<Shop> {
  const ownerId = randomUUID();
  const businessId = randomUUID();
  const serviceId = randomUUID();
  const slug = `og-${businessId.slice(0, 8)}`;
  await database.insert(schema.user).values({ id: ownerId, name: "Dono de teste", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({
    id: businessId,
    ownerId,
    name: "Loja Og Sigilosa",
    slug,
    timezone: "America/Sao_Paulo",
  });
  await database.insert(schema.services).values({
    id: serviceId,
    businessId,
    name: "Corte sigiloso",
    durationMinutes: 30,
    priceCents: 8000,
    depositCents: 2000,
  });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
  await insertConnectedMercadoPago(database, businessId);
  return { ownerId, businessId, slug, serviceId };
}

async function destroyShop(shop: Shop) {
  await database.delete(schema.slotLinkBookings).where(eq(schema.slotLinkBookings.businessId, shop.businessId));
  await database.delete(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId));
  await database.delete(schema.payments).where(eq(schema.payments.businessId, shop.businessId));
  await database.delete(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId));
  await database.delete(schema.customers).where(eq(schema.customers.businessId, shop.businessId));
  await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, shop.businessId));
  await database.delete(schema.services).where(eq(schema.services.businessId, shop.businessId));
  await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, shop.businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, shop.businessId));
  await database.delete(schema.user).where(eq(schema.user.id, shop.ownerId));
}

let shop: Shop;

beforeEach(async () => {
  shop = await seedShop();
});

afterEach(async () => {
  await database.delete(schema.abuseRateLimits).where(inArray(schema.abuseRateLimits.scope, ["slot-link-preview"]));
  await destroyShop(shop);
});

afterAll(async () => {
  await pool.end();
});

async function makeLink(index: number) {
  return createSlotLink(shop.businessId, shop.ownerId, {
    serviceId: shop.serviceId,
    date: DATE,
    time: clock(index),
    customerLabel: OWNER_LABEL,
  }, database);
}

async function linkRow(id: string) {
  const [row] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, id)).limit(1);
  if (!row) throw new Error("link ausente");
  return row;
}

async function occupy(linkId: string) {
  const link = await linkRow(linkId);
  const customerId = randomUUID();
  await database.insert(schema.customers).values({
    id: customerId,
    businessId: shop.businessId,
    name: CUSTOMER_NAME,
    phone: CUSTOMER_PHONE,
  });
  await database.insert(schema.bookings).values({
    id: randomUUID(),
    businessId: shop.businessId,
    serviceId: shop.serviceId,
    customerId,
    startsAt: link.startsAt,
    endsAt: link.endsAt,
    priceCents: 8000,
    depositCents: PAID_CENTS,
    status: "confirmed",
  });
}

async function payLink(linkId: string) {
  const link = await linkRow(linkId);
  const customerId = randomUUID();
  const bookingId = randomUUID();
  await database.insert(schema.customers).values({
    id: customerId,
    businessId: shop.businessId,
    name: CUSTOMER_NAME,
    phone: "+5511988776656",
  });
  await database.insert(schema.bookings).values({
    id: bookingId,
    businessId: shop.businessId,
    serviceId: shop.serviceId,
    customerId,
    startsAt: link.startsAt,
    endsAt: link.endsAt,
    priceCents: 8000,
    depositCents: PAID_CENTS,
    status: "confirmed",
  });
  await database.insert(schema.payments).values({
    businessId: shop.businessId,
    bookingId,
    provider: "fake",
    externalId: `paid-${bookingId}`,
    idempotencyKey: randomUUID(),
    amountCents: PAID_CENTS,
    status: "paid",
    paidAt: new Date("2030-01-01T12:00:00.000Z"),
    expiresAt: new Date("2030-01-02T12:00:00.000Z"),
  });
  await database.update(schema.slotLinks).set({ status: "paid", bookingId }).where(eq(schema.slotLinks.id, linkId));
}

async function wholeResponse(previewId: string) {
  const response = await GET(new Request(`https://agendapix.local/og/slot-link/${previewId}`), {
    params: Promise.resolve({ previewId }),
  });
  const body = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: [...response.headers.entries()], body };
}

describe("imagem OG do link", () => {
  it("ocupado, expirado, pago e id inexistente devolvem a mesma resposta, e o disponível é outro cartão", async () => {
    const taken = await makeLink(0);
    const expired = await makeLink(1);
    const paid = await makeLink(2);
    const open = await makeLink(3);
    await occupy(taken.id);
    await database.update(schema.slotLinks).set({
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      expiresAt: new Date("2026-01-02T12:00:00.000Z"),
    }).where(eq(schema.slotLinks.id, expired.id));
    await payLink(paid.id);
    const missingId = createSlotLinkPreviewId();
    expect((await readSlotLinkOgCard(taken.previewId, "peer:og", database)).kind).toBe("unavailable");
    expect((await readSlotLinkOgCard(expired.previewId, "peer:og", database)).kind).toBe("unavailable");
    expect((await readSlotLinkOgCard(paid.previewId, "peer:og", database)).kind).toBe("unavailable");
    expect((await readSlotLinkOgCard(missingId, "peer:og", database)).kind).toBe("unavailable");
    expect((await readSlotLinkOgCard(open.previewId, "peer:og", database)).kind).toBe("slot");

    const [takenImage, expiredImage, paidImage, missingImage, openImage] = await Promise.all([
      wholeResponse(taken.previewId),
      wholeResponse(expired.previewId),
      wholeResponse(paid.previewId),
      wholeResponse(missingId),
      wholeResponse(open.previewId),
    ]);

    expect(takenImage.status).toBe(200);
    expect(takenImage.headers).toEqual(expiredImage.headers);
    expect(takenImage.headers).toEqual(paidImage.headers);
    expect(takenImage.headers).toEqual(missingImage.headers);
    expect(Buffer.compare(takenImage.body, expiredImage.body)).toBe(0);
    expect(Buffer.compare(takenImage.body, paidImage.body)).toBe(0);
    expect(Buffer.compare(takenImage.body, missingImage.body)).toBe(0);
    expect(takenImage.body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

    const header = Object.fromEntries(takenImage.headers);
    expect(header["content-type"]).toBe("image/png");
    expect(header["cache-control"]).toBe("no-store");
    expect(header.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(header["content-length"]).toBe(String(takenImage.body.byteLength));
    expect(header["referrer-policy"]).toBe("no-referrer");
    expect(header["x-robots-tag"]).toBe("noindex, nofollow");

    expect(takenImage.body.includes(Buffer.from(CUSTOMER_NAME))).toBe(false);
    expect(takenImage.body.includes(Buffer.from(CUSTOMER_PHONE))).toBe(false);
    expect(takenImage.body.includes(Buffer.from(OWNER_LABEL))).toBe(false);
    expect(takenImage.body.includes(Buffer.from("Loja Og Sigilosa"))).toBe(false);
    expect(takenImage.body.includes(Buffer.from("Corte sigiloso"))).toBe(false);

    expect(openImage.status).toBe(200);
    expect(openImage.body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(Buffer.compare(openImage.body, takenImage.body)).not.toBe(0);
    expect(Object.fromEntries(openImage.headers).etag).not.toBe(header.etag);
    expect(openImage.body.includes(Buffer.from(CUSTOMER_NAME))).toBe(false);
    expect(openImage.body.includes(Buffer.from(OWNER_LABEL))).toBe(false);

    const shots = "/opt/cursor/artifacts";
    await mkdir(shots, { recursive: true });
    await writeFile(path.join(shots, "og-slot-link-disponivel.png"), openImage.body);
    await writeFile(path.join(shots, "og-slot-link-indisponivel.png"), takenImage.body);
  }, 60_000);
});
