import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { bookingConfig } from "../../lib/bookings/config";
import { createBooking } from "../../lib/bookings/service";
import { cancelSlotLink, createSlotLink, listSlotLinks, openSlotLink, paySlotLink, readSlotLinkPreview } from "../../lib/bookings/slot-link";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider } from "../../lib/payments/fake";
import { padraoPolicyHash } from "../helpers/deposit-policy";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const provider = new FakePaymentProvider("test-only-webhook-secret-with-32-characters");
const DATE = "2030-01-01";
const clock = (index: number) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
const phone = (index: number) => `+55119${String(80000000 + index).padStart(8, "0")}`;

type Shop = { ownerId: string; businessId: string; slug: string; serviceId: string };

async function seedShop(label: string): Promise<Shop> {
  const ownerId = randomUUID();
  const businessId = randomUUID();
  const serviceId = randomUUID();
  const slug = `${label}-${businessId.slice(0, 8)}`;
  await database.insert(schema.user).values({ id: ownerId, name: "Dono de teste", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Negócio de teste", slug, contactWhatsapp: "+5511988880000" });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 8000, depositCents: 2000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
  await insertConnectedMercadoPago(database, businessId);
  return { ownerId, businessId, slug, serviceId };
}

async function destroyShop(shop: Shop) {
  await database.delete(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId));
  await database.delete(schema.paymentRefunds).where(eq(schema.paymentRefunds.businessId, shop.businessId));
  await database.delete(schema.ownerNotices).where(eq(schema.ownerNotices.businessId, shop.businessId));
  await database.delete(schema.payments).where(eq(schema.payments.businessId, shop.businessId));
  await database.delete(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId));
  await database.delete(schema.customers).where(eq(schema.customers.businessId, shop.businessId));
  await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, shop.businessId));
  await database.delete(schema.services).where(eq(schema.services.businessId, shop.businessId));
  await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, shop.businessId));
  await database.delete(schema.bookingRateLimits).where(eq(schema.bookingRateLimits.businessId, shop.businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, shop.businessId));
  await database.delete(schema.user).where(eq(schema.user.id, shop.ownerId));
}

let shop: Shop;
const shops: Shop[] = [];

beforeEach(async () => {
  shop = await seedShop("link");
  shops.splice(0, shops.length, shop);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await database.delete(schema.abuseRateLimits).where(inArray(schema.abuseRateLimits.scope, ["slot-link-open-probe", "slot-link-pay-token", "slot-link-pay-probe"]));
  for (const current of shops) await destroyShop(current);
  shops.length = 0;
});
afterAll(async () => { await pool.end(); });

function payBody(index: number) {
  return {
    customer: { name: "Cliente do link", phone: phone(index) },
    policyHash: padraoPolicyHash("Negócio de teste", 2000),
  };
}

async function makeLink(index = 0, owner = shop) {
  return createSlotLink(owner.businessId, owner.ownerId, {
    serviceId: owner.serviceId, date: DATE, time: clock(index), customerLabel: "Ana da mensagem",
  }, database);
}

describe("link de um horário", () => {
  it("gerar não cria reserva e o prazo não passa do início", async () => {
    const before = Date.now();
    const created = await makeLink();
    expect(created.token).toHaveLength(43);
    expect(created.path).toBe(`/api/public/${shop.slug}/slot-links/${created.token}`);
    expect(created.path.includes("#")).toBe(false);
    expect(created.customerLabel).toBe("Ana da mensagem");
    expect(new Date(created.expiresAt).getTime()).toBeLessThanOrEqual(new Date(created.startsAt).getTime());
    expect(new Date(created.expiresAt).getTime()).toBeGreaterThanOrEqual(before + bookingConfig().SLOT_LINK_TTL_MINUTES * 60_000 - 5000);
    expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId))).toHaveLength(0);
    const opened = await openSlotLink(shop.slug, created.token, "peer:192.0.2.1", database);
    expect(opened.status).toBe("pending");
    expect(opened.depositCents).toBe(2000);
    expect(opened.remainingCents).toBe(6000);
    expect(opened.business.publicPath).toBe(`/${shop.slug}`);
    expect(opened.policy?.hash).toBe(padraoPolicyHash("Negócio de teste", 2000));
    expect(JSON.stringify(opened)).not.toContain("Ana");
    expect(JSON.stringify(opened)).not.toContain(created.token);
    const [row] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(created.token);
    expect(row.previewId).not.toBe(created.token);
    const preview = await readSlotLinkPreview(created.previewId, database);
    expect(preview).toEqual({ businessName: "Negócio de teste", serviceName: "Corte", date: DATE, time: clock(0) });
    expect(preview).not.toHaveProperty("status");
    expect(JSON.stringify(preview)).not.toContain("Ana");
  });

  it("token desconhecido, malformado ou de outro negócio devolve o mesmo 404", async () => {
    const created = await makeLink();
    const other = await seedShop("outro");
    shops.push(other);
    const unknown = await openSlotLink(shop.slug, "C".repeat(43), "peer:192.0.2.20", database).catch((error) => error);
    const foreign = await openSlotLink(other.slug, created.token, "peer:192.0.2.21", database).catch((error) => error);
    const malformed = await openSlotLink(shop.slug, "curto", null, database).catch((error) => error);
    expect(unknown).toMatchObject({ status: 404, code: "link_invalid" });
    expect(foreign).toMatchObject({ status: 404, code: "link_invalid", message: unknown.message });
    expect(malformed).toMatchObject({ status: 404, code: "link_invalid", message: unknown.message });
    const db = { execute: () => { throw new Error("banco"); }, select: () => { throw new Error("banco"); } };
    await expect(openSlotLink(shop.slug, "curto", null, db as never)).rejects.toMatchObject({ code: "link_invalid" });
  });

  it("horário ocupado depois do link: abrir mostra taken e pagar devolve 409 sem Pix novo", async () => {
    const created = await makeLink();
    await createBooking(shop.slug, {
      serviceId: shop.serviceId,
      startsAt: created.startsAt,
      customer: { name: "Outra cliente", phone: phone(3) },
      policyHash: padraoPolicyHash("Negócio de teste", 2000),
    }, randomUUID(), database, provider, "peer:192.0.2.30");
    const opened = await openSlotLink(shop.slug, created.token, "peer:192.0.2.31", database);
    expect(opened.status).toBe("taken");
    const paymentsBefore = await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId));
    await expect(paySlotLink(shop.slug, created.token, payBody(4), "peer:192.0.2.32", database, provider)).rejects.toMatchObject({
      status: 409, code: "slot_unavailable",
    });
    const paymentsAfter = await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId));
    expect(paymentsAfter).toHaveLength(paymentsBefore.length);
  });

  it("duas cobranças concorrentes: exatamente uma cria o Pix", async () => {
    const created = await makeLink(1);
    const results = await Promise.allSettled([
      paySlotLink(shop.slug, created.token, payBody(5), "peer:192.0.2.40", database, provider),
      paySlotLink(shop.slug, created.token, payBody(6), "peer:192.0.2.41", database, provider),
    ]);
    const won = results.filter((result) => result.status === "fulfilled");
    const lost = results.filter((result) => result.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({ reason: expect.objectContaining({ status: 409 }) });
    const bookings = await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId));
    const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId));
    expect(bookings).toHaveLength(1);
    expect(payments).toHaveLength(1);
    expect(payments[0]?.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
    const holdMs = new Date(bookings[0].expiresAt!).getTime() - bookings[0].createdAt.getTime();
    expect(holdMs).toBeLessThanOrEqual(bookingConfig().BOOKING_HOLD_MINUTES * 60_000 + 1500);
    expect(holdMs).toBeGreaterThanOrEqual(bookingConfig().BOOKING_HOLD_MINUTES * 60_000 - 1500);
  });

  it("link vencido fica expirado e o hold de um pagamento não passa de BOOKING_HOLD_MINUTES", async () => {
    const created = await makeLink(2);
    const past = new Date(Date.now() - 60_000);
    await database.update(schema.slotLinks).set({ createdAt: new Date(Date.now() - 86_400_000), expiresAt: past }).where(eq(schema.slotLinks.id, created.id));
    expect((await openSlotLink(shop.slug, created.token, "peer:192.0.2.50", database)).status).toBe("expired");
    await expect(paySlotLink(shop.slug, created.token, payBody(7), "peer:192.0.2.51", database, provider)).rejects.toMatchObject({
      status: 410, code: "link_expired",
    });
    expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId))).toHaveLength(0);
  });

  it("link cancelado não cobra e o dono A não lista nem cancela o link do dono B", async () => {
    const created = await makeLink(3);
    const other = await seedShop("vizinho");
    shops.push(other);
    const foreign = await makeLink(0, other);
    expect((await cancelSlotLink(shop.businessId, shop.ownerId, created.id, database)).status).toBe("cancelled");
    expect((await openSlotLink(shop.slug, created.token, "peer:192.0.2.60", database)).status).toBe("cancelled");
    await expect(paySlotLink(shop.slug, created.token, payBody(8), "peer:192.0.2.61", database, provider)).rejects.toMatchObject({
      status: 409, code: "link_cancelled",
    });
    const listed = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE }, database);
    expect(listed.links.map((link) => link.id)).toEqual([created.id]);
    expect(listed.links[0]?.customerLabel).toBe("Ana da mensagem");
    await expect(listSlotLinks(other.businessId, shop.ownerId, { date: DATE }, database)).rejects.toMatchObject({ status: 404, code: "business_unavailable" });
    await expect(cancelSlotLink(shop.businessId, shop.ownerId, foreign.id, database)).rejects.toMatchObject({ status: 404, code: "link_invalid" });
    await expect(cancelSlotLink(other.businessId, shop.ownerId, foreign.id, database)).rejects.toMatchObject({ status: 404, code: "business_unavailable" });
    const [still] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, foreign.id));
    expect(still.status).toBe("pending");
    expect(await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId))).toHaveLength(0);
  });

  it("limita criação, abertura e início de pagamento", async () => {
    vi.stubEnv("SLOT_LINK_CREATE_PER_OWNER", "2");
    const created = await makeLink(4);
    await makeLink(5);
    await expect(makeLink(6)).rejects.toMatchObject({ status: 429, code: "rate_limited" });
    expect(await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId))).toHaveLength(2);
    const page = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE, limit: 1 }, database);
    expect(page.links).toHaveLength(1);
    expect(page.nextCursor).toEqual(expect.any(String));
    const rest = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE, limit: 1, cursor: page.nextCursor }, database);
    expect(rest.links).toHaveLength(1);
    expect(rest.links[0]?.id).not.toBe(page.links[0]?.id);
    expect(rest.nextCursor).toBeNull();

    vi.stubEnv("SLOT_LINK_OPEN_PER_CLIENT", "2");
    vi.stubEnv("SLOT_LINK_OPEN_PER_BUSINESS", "20");
    await openSlotLink(shop.slug, created.token, "peer:192.0.2.70", database);
    await openSlotLink(shop.slug, created.token, "peer:192.0.2.70", database);
    await expect(openSlotLink(shop.slug, created.token, "peer:192.0.2.70", database)).rejects.toMatchObject({ status: 429, code: "rate_limited" });

    vi.stubEnv("SLOT_LINK_PAY_PER_TOKEN", "1");
    await expect(paySlotLink(shop.slug, created.token, {
      customer: { name: "Ana", phone: "invalido" },
      policyHash: "ab".repeat(32),
    }, "peer:192.0.2.71", database, provider)).rejects.toMatchObject({ status: 400, code: "invalid_input" });
    await expect(paySlotLink(shop.slug, created.token, payBody(9), "peer:192.0.2.72", database, provider)).rejects.toMatchObject({
      status: 429, code: "rate_limited",
    });
    expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId))).toHaveLength(0);
  });

  it("sem Mercado Pago não gera o link nem o Pix", async () => {
    await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, shop.businessId));
    await expect(makeLink()).rejects.toMatchObject({ status: 409, code: "mp_not_connected" });
    expect(await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId))).toHaveLength(0);
    await insertConnectedMercadoPago(database, shop.businessId);
    const created = await makeLink(8);
    await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, shop.businessId));
    await expect(paySlotLink(shop.slug, created.token, payBody(10), "peer:192.0.2.80", database, provider)).rejects.toMatchObject({
      status: 409, code: "mp_not_connected",
    });
    expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId))).toHaveLength(0);
  });

  it("recusa link que venceria depois do horário", async () => {
    const startsAt = new Date("2030-01-01T12:00:00.000Z");
    await expect(database.insert(schema.slotLinks).values({
      businessId: shop.businessId,
      serviceId: shop.serviceId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      expiresAt: new Date(startsAt.getTime() + 60_000),
      tokenHash: "ab".repeat(32),
      previewId: "bbbbbbbbbbbbbbbbbbbbbb",
    })).rejects.toThrow();
  });
});
