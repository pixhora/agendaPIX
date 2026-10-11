import { createHash, createHmac, randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { bookingConfig } from "../../lib/bookings/config";
import { signBookingAccessToken } from "../../lib/bookings/access-mac";
import { createBooking, getBookingPayment, hash } from "../../lib/bookings/service";
import * as bookingService from "../../lib/bookings/service";
import { cancelSlotLink, createSlotLink, deleteSlotLinksForBusiness, listSlotLinks, openSlotLink, paySlotLink, purgeExpiredSlotLinkLabels, readSlotLinkPreview, reissueSlotLink, slotLinkPayIdempotencyHash, slotLinkPayMessage } from "../../lib/bookings/slot-link";
import { dashboardBookings } from "../../lib/dashboard/data";
import { databaseEnvSchema } from "../../lib/env";
import { applyPaidEvent } from "../../lib/payments/apply-paid";
import { FakePaymentProvider } from "../../lib/payments/fake";
import { polledPaidEvent } from "../../lib/payments/provider";
import { drizzleRefundPorts, settleAutomaticLateRefund } from "../../lib/payments/refund-flow";
import { PIX_APPROVAL_TOLERANCE_MS } from "../../lib/payments/rules";
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
  await database.delete(schema.slotLinkBookings).where(eq(schema.slotLinkBookings.businessId, shop.businessId));
  await database.delete(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId));
  await database.delete(schema.paymentRefunds).where(eq(schema.paymentRefunds.businessId, shop.businessId));
  await database.delete(schema.ownerNotices).where(eq(schema.ownerNotices.businessId, shop.businessId));
  await database.delete(schema.paymentAudit).where(eq(schema.paymentAudit.businessId, shop.businessId));
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
  await database.delete(schema.abuseRateLimits).where(inArray(schema.abuseRateLimits.scope, ["slot-link-open-probe", "slot-link-pay-token", "slot-link-pay-probe", "slot-link-preview"]));
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

function payKey(index: number) {
  return `paykey${String(index).padStart(16, "0")}`;
}

function pay(token: string, index: number, identity: string, key = payKey(index), slug = shop.slug) {
  return paySlotLink(slug, token, payBody(index), key, identity, database, provider);
}

async function ageHold(linkId: string, bookingId: string | null) {
  const born = new Date(Date.now() - (bookingConfig().BOOKING_HOLD_MINUTES + 10) * 60_000);
  const pastExpiry = new Date(Date.now() - 60_000);
  await database.update(schema.slotLinks).set({ payStartedAt: born }).where(eq(schema.slotLinks.id, linkId));
  if (!bookingId) return;
  await database.update(schema.bookings).set({ createdAt: born, expiresAt: pastExpiry }).where(eq(schema.bookings.id, bookingId));
  await database.update(schema.payments).set({ createdAt: born, expiresAt: pastExpiry }).where(eq(schema.payments.bookingId, bookingId));
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
    expect(created.cancellable).toBe(true);
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
    const preview = await readSlotLinkPreview(created.previewId, "peer:192.0.2.1", database);
    expect(preview).toEqual({ kind: "slot", businessName: "Negócio de teste", logoUrl: null, serviceName: "Corte", date: DATE, time: clock(0) });
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
    await expect(pay(created.token, 4, "peer:192.0.2.32")).rejects.toMatchObject({
      status: 409, code: "slot_unavailable",
    });
    const paymentsAfter = await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId));
    expect(paymentsAfter).toHaveLength(paymentsBefore.length);
  });

  it("duas cobranças concorrentes: exatamente uma cria o Pix", async () => {
    const created = await makeLink(1);
    const results = await Promise.allSettled([
      pay(created.token, 5, "peer:192.0.2.40"),
      pay(created.token, 6, "peer:192.0.2.41"),
    ]);
    const won = results.filter((result) => result.status === "fulfilled");
    const lost = results.filter((result) => result.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({ reason: expect.objectContaining({ status: 409, code: "link_in_progress" }) });
    expect(JSON.stringify((lost[0] as PromiseRejectedResult).reason)).not.toContain("Cliente do link");
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
    await expect(pay(created.token, 7, "peer:192.0.2.51")).rejects.toMatchObject({
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
    await expect(pay(created.token, 8, "peer:192.0.2.61")).rejects.toMatchObject({
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
    }, payKey(90), "peer:192.0.2.71", database, provider)).rejects.toMatchObject({ status: 400, code: "invalid_input" });
    await expect(pay(created.token, 9, "peer:192.0.2.72")).rejects.toMatchObject({
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
    await expect(pay(created.token, 10, "peer:192.0.2.80")).rejects.toMatchObject({
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

  it("a mesma chave retoma o Pix e outra chave no claim ativo recebe link_in_progress", async () => {
    const created = await makeLink(0);
    await expect(paySlotLink(shop.slug, created.token, payBody(11), null, "peer:192.0.2.109", database, provider)).rejects.toMatchObject({ status: 400, code: "invalid_input" });
    await expect(paySlotLink(shop.slug, created.token, payBody(11), "curta", "peer:192.0.2.109", database, provider)).rejects.toMatchObject({ status: 400, code: "invalid_input" });
    const first = await pay(created.token, 11, "peer:192.0.2.110", payKey(11));
    const again = await pay(created.token, 11, "peer:192.0.2.111", payKey(11));
    expect(again.bookingId).toBe(first.bookingId);
    expect(again.accessToken).toBe(first.accessToken);
    expect(again.payment?.id).toBe(first.payment?.id);
    expect(again.payment?.externalId).toBe(first.payment?.externalId);
    expect(again.payment?.copyPaste).toBe(first.payment?.copyPaste);
    expect(again.payment?.qrCodeDataUrl).toBe(first.payment?.qrCodeDataUrl);
    expect(again.payment?.expiresAt).toBe(first.payment?.expiresAt);
    expect(await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId))).toHaveLength(1);
    const listed = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE }, database);
    expect(listed.links.find((link) => link.id === created.id)?.cancellable).toBe(false);
    await expect(cancelSlotLink(shop.businessId, shop.ownerId, created.id, database)).rejects.toMatchObject({ status: 409, code: "link_used" });
    const blocked = await pay(created.token, 12, "peer:192.0.2.112", payKey(12)).catch((error) => error);
    expect(blocked).toMatchObject({ status: 409, code: "link_in_progress" });
    const dumped = JSON.stringify(blocked);
    expect(dumped).not.toContain(first.accessToken);
    expect(dumped).not.toContain(first.payment?.copyPaste);
    expect(dumped).not.toContain("Cliente do link");
    const [row] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(row.payIdempotencyHash).toBe(slotLinkPayIdempotencyHash(created.id, payKey(11)));
    expect(row.payIdempotencyHash).not.toBe(createHash("sha256").update(created.id).digest("hex"));
  });

  it("claim vencido sem reserva pode ser reassumido e cancelado, e duas chaves disputam uma só", async () => {
    const created = await makeLink(0);
    const hash = slotLinkPayIdempotencyHash(created.id, payKey(1));
    const born = new Date(Date.now() - (bookingConfig().BOOKING_HOLD_MINUTES + 5) * 60_000);
    await database.update(schema.slotLinks).set({ payStartedAt: born, payIdempotencyHash: hash }).where(eq(schema.slotLinks.id, created.id));
    const listed = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE }, database);
    expect(listed.links[0]?.cancellable).toBe(true);
    const results = await Promise.allSettled([
      pay(created.token, 13, "peer:192.0.2.130", payKey(13)),
      pay(created.token, 14, "peer:192.0.2.131", payKey(14)),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: expect.objectContaining({ status: 409, code: "link_in_progress" }),
    });
    expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId))).toHaveLength(1);

    const idle = await makeLink(1);
    await database.update(schema.slotLinks).set({
      payStartedAt: born,
      payIdempotencyHash: slotLinkPayIdempotencyHash(idle.id, payKey(2)),
    }).where(eq(schema.slotLinks.id, idle.id));
    expect((await cancelSlotLink(shop.businessId, shop.ownerId, idle.id, database)).status).toBe("cancelled");
  });

  it("chave nova assume o hold vencido, solta a reserva antiga e o Pix antigo cai no atraso", async () => {
    await database.update(schema.businesses).set({ latePaymentPolicy: "rebook_if_free" }).where(eq(schema.businesses.id, shop.businessId));
    const created = await makeLink(0);
    const first = await pay(created.token, 15, "peer:192.0.2.150", payKey(15));
    await ageHold(created.id, first.bookingId);
    const second = await pay(created.token, 16, "peer:192.0.2.151", payKey(16));
    expect(second.bookingId).not.toBe(first.bookingId);
    const [oldBooking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, first.bookingId));
    expect(oldBooking.status).toBe("expired");
    const [fresh] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, second.bookingId));
    expect(fresh.status).toBe("pending_payment");
    const charge = provider.markPaid(first.payment!.externalId!, new Date(Date.now() + PIX_APPROVAL_TOLERANCE_MS));
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result).toMatchObject({ outcome: "ignored", reason: "late_no_slot", bookingId: first.bookingId });
    });
    expect(await settleAutomaticLateRefund(drizzleRefundPorts(database), provider, first.payment!.id, async () => {})).toBe("submitted");
    const [oldAfter] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, first.bookingId));
    const [newAfter] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, second.bookingId));
    const [oldPayment] = await database.select().from(schema.payments).where(eq(schema.payments.bookingId, first.bookingId));
    expect(oldAfter.status).toBe("expired");
    expect(newAfter.status).toBe("pending_payment");
    expect(oldPayment.refundStatus).toBe("refunded");
    expect(oldPayment.status).toBe("refunded");
    const [link] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(link.status).not.toBe("paid");
    expect(link.bookingId).toBe(second.bookingId);
    const listed = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE }, database);
    expect(listed.links.find((item) => item.id === created.id)?.status).toBe("pending");
  });

  it("late_rebooked da reserva antiga marca o link como pago", async () => {
    await database.update(schema.businesses).set({ latePaymentPolicy: "rebook_if_free" }).where(eq(schema.businesses.id, shop.businessId));
    const created = await makeLink(0);
    const first = await pay(created.token, 15, "peer:192.0.2.152", payKey(25));
    await ageHold(created.id, first.bookingId);
    const second = await pay(created.token, 16, "peer:192.0.2.153", payKey(26));
    await ageHold(created.id, second.bookingId);
    await database.transaction(async (tx) => {
      await bookingService.expirePending(tx, shop.businessId, new Date());
    });
    const charge = provider.markPaid(first.payment!.externalId!, new Date(Date.now() + PIX_APPROVAL_TOLERANCE_MS));
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result).toMatchObject({ outcome: "processed", reason: "late_rebooked", bookingId: first.bookingId });
    });
    const [link] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(link.status).toBe("paid");
    expect(link.bookingId).toBe(first.bookingId);
    const listed = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE }, database);
    expect(listed.links.find((item) => item.id === created.id)?.status).toBe("paid");
  });

  it("late_no_slot com a reserva nova também vencida deixa o link expirado", async () => {
    const created = await makeLink(0);
    const first = await pay(created.token, 15, "peer:192.0.2.154", payKey(27));
    await ageHold(created.id, first.bookingId);
    const second = await pay(created.token, 16, "peer:192.0.2.155", payKey(28));
    await ageHold(created.id, second.bookingId);
    await database.transaction(async (tx) => {
      await bookingService.expirePending(tx, shop.businessId, new Date());
    });
    const charge = provider.markPaid(first.payment!.externalId!, new Date(Date.now() + PIX_APPROVAL_TOLERANCE_MS));
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result).toMatchObject({ outcome: "ignored", reason: "late_no_slot", bookingId: first.bookingId });
    });
    const [link] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(link.status).not.toBe("paid");
    const listed = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE }, database);
    expect(listed.links.find((item) => item.id === created.id)?.status).toBe("expired");
  });

  it("a mesma chave retoma o mesmo Pix depois que o prazo do link passou", async () => {
    const created = await makeLink(0);
    const first = await pay(created.token, 11, "peer:192.0.2.156", payKey(29));
    const past = new Date(Date.now() - 60_000);
    await database.update(schema.slotLinks).set({
      createdAt: new Date(past.getTime() - 60_000),
      expiresAt: past,
    }).where(eq(schema.slotLinks.id, created.id));
    const again = await pay(created.token, 11, "peer:192.0.2.157", payKey(29));
    expect(again.bookingId).toBe(first.bookingId);
    expect(again.payment?.id).toBe(first.payment?.id);
    expect(again.payment?.copyPaste).toBe(first.payment?.copyPaste);
    expect(again.accessToken).toBe(first.accessToken);
    expect(await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId))).toHaveLength(1);
    await expect(pay(created.token, 12, "peer:192.0.2.158", payKey(30))).rejects.toMatchObject({ status: 410, code: "link_expired" });
  });

  it("duas chaves disputam a retomada de um hold vencido e só uma vence", async () => {
    const created = await makeLink(0);
    const first = await pay(created.token, 17, "peer:192.0.2.170", payKey(17));
    await ageHold(created.id, first.bookingId);
    const results = await Promise.allSettled([
      pay(created.token, 18, "peer:192.0.2.180", payKey(18)),
      pay(created.token, 19, "peer:192.0.2.181", payKey(19)),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: expect.objectContaining({ code: "link_in_progress" }),
    });
    const bookings = await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId));
    expect(bookings.filter((booking) => booking.status === "pending_payment")).toHaveLength(1);
    expect(bookings.filter((booking) => booking.status === "expired")).toHaveLength(1);
  });

  it("pagamento confirmado marca o link como pago e um novo POST devolve link_used", async () => {
    const created = await makeLink(0);
    const first = await pay(created.token, 20, "peer:192.0.2.200", payKey(20));
    const charge = provider.markPaid(first.payment!.externalId!);
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result.outcome).toBe("processed");
    });
    const [row] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(row.status).toBe("paid");
    expect((await openSlotLink(shop.slug, created.token, "peer:192.0.2.201", database)).status).toBe("paid");
    await expect(pay(created.token, 20, "peer:192.0.2.202", payKey(20))).rejects.toMatchObject({ status: 409, code: "link_used" });
    await expect(pay(created.token, 21, "peer:192.0.2.203", payKey(21))).rejects.toMatchObject({ status: 409, code: "link_used" });
    expect(await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId))).toHaveLength(1);
  });

  it("23P01 dentro de createBooking vira 409", async () => {
    const created = await makeLink(0);
    const boom = Object.assign(new Error("exclusion"), { code: "23P01" });
    const spy = vi.spyOn(bookingService, "createBooking").mockRejectedValueOnce(boom);
    await expect(pay(created.token, 22, "peer:192.0.2.220", payKey(22))).rejects.toMatchObject({ status: 409, code: "slot_unavailable" });
    spy.mockRestore();
    const [row] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(row.status).toBe("taken");
  });

  it("horário que já passou devolve expirado, mesmo ocupado", async () => {
    const created = await makeLink(0);
    const startsAt = new Date(Date.now() - 2 * 60 * 60_000);
    const expiresAt = new Date(startsAt.getTime() - 60_000);
    await database.update(schema.slotLinks).set({
      createdAt: new Date(expiresAt.getTime() - 60_000),
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      expiresAt,
    }).where(eq(schema.slotLinks.id, created.id));
    const [customer] = await database.insert(schema.customers).values({ businessId: shop.businessId, name: "Ocupou", phone: phone(40) }).returning();
    await database.insert(schema.bookings).values({
      businessId: shop.businessId,
      serviceId: shop.serviceId,
      customerId: customer.id,
      requestKey: randomUUID(),
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      priceCents: 8000,
      depositCents: 2000,
      status: "confirmed",
    });
    expect((await openSlotLink(shop.slug, created.token, "peer:192.0.2.240", database)).status).toBe("expired");
    await expect(pay(created.token, 23, "peer:192.0.2.241", payKey(23))).rejects.toMatchObject({ status: 410, code: "link_expired" });
  });

  it("prévia conhecida fora de pending é genérica e o limite não depende de token aleatório", async () => {
    const created = await makeLink(0);
    expect((await cancelSlotLink(shop.businessId, shop.ownerId, created.id, database)).status).toBe("cancelled");
    const generic = await readSlotLinkPreview(created.previewId, "peer:192.0.2.250", database);
    expect(generic).toEqual({ kind: "generic", businessName: "Negócio de teste", logoUrl: null });
    expect(generic).not.toHaveProperty("serviceName");
    await expect(readSlotLinkPreview("e".repeat(22), "peer:192.0.2.251", database)).rejects.toMatchObject({ status: 404, code: "link_invalid" });

    const before = await database.select().from(schema.abuseRateLimits).where(eq(schema.abuseRateLimits.scope, "slot-link-pay-token"));
    await expect(paySlotLink(shop.slug, "F".repeat(43), payBody(24), payKey(24), "peer:192.0.2.252", database, provider)).rejects.toMatchObject({
      status: 404, code: "link_invalid",
    });
    const after = await database.select().from(schema.abuseRateLimits).where(eq(schema.abuseRateLimits.scope, "slot-link-pay-token"));
    expect(after).toHaveLength(before.length);

    vi.stubEnv("SLOT_LINK_OPEN_PER_CLIENT", "1");
    await readSlotLinkPreview(created.previewId, null, database);
    await readSlotLinkPreview(created.previewId, null, database);
    await readSlotLinkPreview(created.previewId, "peer:192.0.2.253", database);
    await expect(readSlotLinkPreview(created.previewId, "peer:192.0.2.253", database)).rejects.toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("retomada e confirmação recriam o vínculo se ele sumiu depois da reserva", async () => {
    const created = await makeLink(0);
    const first = await pay(created.token, 31, "peer:192.0.2.310", payKey(31));
    await database.delete(schema.slotLinkBookings).where(eq(schema.slotLinkBookings.bookingId, first.bookingId));
    await database.update(schema.slotLinks).set({ bookingId: null }).where(eq(schema.slotLinks.id, created.id));
    const again = await pay(created.token, 31, "peer:192.0.2.311", payKey(31));
    expect(again.payment?.id).toBe(first.payment?.id);
    const [relinked] = await database.select().from(schema.slotLinkBookings).where(eq(schema.slotLinkBookings.bookingId, first.bookingId));
    expect(relinked?.slotLinkId).toBe(created.id);
    const [pointed] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(pointed.bookingId).toBe(first.bookingId);

    await database.delete(schema.slotLinkBookings).where(eq(schema.slotLinkBookings.bookingId, first.bookingId));
    await database.update(schema.slotLinks).set({ bookingId: null }).where(eq(schema.slotLinks.id, created.id));
    const charge = provider.markPaid(first.payment!.externalId!);
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result.outcome).toBe("processed");
    });
    const [afterPay] = await database.select().from(schema.slotLinkBookings).where(eq(schema.slotLinkBookings.bookingId, first.bookingId));
    expect(afterPay?.slotLinkId).toBe(created.id);
    const [paid] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(paid.status).toBe("paid");
    expect(paid.bookingId).toBe(first.bookingId);
  });

  it("reemite o link pendente e o token antigo responde link_replaced", async () => {
    const created = await makeLink(0);
    const other = await seedShop("vizinho-reissue");
    shops.push(other);
    const foreign = await makeLink(0, other);
    await expect(reissueSlotLink(shop.businessId, shop.ownerId, foreign.id, database)).rejects.toMatchObject({ status: 404, code: "link_invalid" });
    await expect(reissueSlotLink(other.businessId, shop.ownerId, foreign.id, database)).rejects.toMatchObject({ status: 404, code: "business_unavailable" });
    const [untouched] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, foreign.id));
    expect(untouched.status).toBe("pending");

    const renewed = await reissueSlotLink(shop.businessId, shop.ownerId, created.id, database);
    expect(renewed.id).not.toBe(created.id);
    expect(renewed.status).toBe("pending");
    expect(renewed.token).not.toBe(created.token);
    expect(renewed.path).toBe(`/api/public/${shop.slug}/slot-links/${renewed.token}`);
    const [oldRow] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(oldRow.status).toBe("replaced");
    expect(oldRow.replacedByLinkId).toBe(renewed.id);
    const listed = await listSlotLinks(shop.businessId, shop.ownerId, { date: DATE }, database);
    expect(listed.links.find((link) => link.id === created.id)?.status).toBe("replaced");
    expect(listed.links.find((link) => link.id === renewed.id)?.status).toBe("pending");
    const replaced = await openSlotLink(shop.slug, created.token, "peer:192.0.2.320", database).catch((error) => error);
    expect(replaced).toMatchObject({ status: 409, code: "link_replaced" });
    expect(JSON.stringify(replaced)).not.toContain(renewed.token);
    await expect(pay(created.token, 32, "peer:192.0.2.321", payKey(32))).rejects.toMatchObject({ status: 409, code: "link_replaced" });
    const preview = await readSlotLinkPreview(created.previewId, "peer:192.0.2.322", database);
    expect(preview).toEqual({ kind: "generic", businessName: "Negócio de teste", logoUrl: null });
    expect(JSON.stringify(preview)).not.toContain(renewed.token);
    expect(preview).not.toHaveProperty("serviceName");
  });

  it("não reemite um link pago e o link antigo não muda", async () => {
    const created = await makeLink(0);
    const first = await pay(created.token, 35, "peer:192.0.2.350", payKey(35));
    const charge = provider.markPaid(first.payment!.externalId!);
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result.outcome).toBe("processed");
    });
    const [before] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(before.status).toBe("paid");
    await expect(reissueSlotLink(shop.businessId, shop.ownerId, created.id, database)).rejects.toMatchObject({ status: 409, code: "link_used" });
    const [after] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(after).toMatchObject({
      status: "paid",
      bookingId: before.bookingId,
      tokenHash: before.tokenHash,
      previewId: before.previewId,
      replacedByLinkId: null,
      payIdempotencyHash: before.payIdempotencyHash,
    });
    expect(await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId))).toHaveLength(1);
  });

  it("não reemite com claim ativo e não mexe no link se o horário foi ocupado", async () => {
    const claimed = await makeLink(0);
    await pay(claimed.token, 33, "peer:192.0.2.330", payKey(33));
    await expect(reissueSlotLink(shop.businessId, shop.ownerId, claimed.id, database)).rejects.toMatchObject({ status: 409, code: "link_in_progress" });
    const [still] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, claimed.id));
    expect(still.status).toBe("pending");
    expect(await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId))).toHaveLength(1);

    const taken = await makeLink(1);
    const startsAt = new Date(`${DATE}T12:30:00.000Z`);
    const customerId = randomUUID();
    await database.insert(schema.customers).values({ id: customerId, businessId: shop.businessId, name: "Outra cliente", phone: phone(90) });
    await database.insert(schema.bookings).values({
      businessId: shop.businessId,
      serviceId: shop.serviceId,
      customerId,
      requestKey: randomUUID(),
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      priceCents: 8000,
      depositCents: 2000,
      status: "confirmed",
    });
    await expect(reissueSlotLink(shop.businessId, shop.ownerId, taken.id, database)).rejects.toMatchObject({ status: 409, code: "slot_unavailable" });
    const [kept] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, taken.id));
    expect(kept.status).toBe("pending");
    expect(kept.replacedByLinkId).toBeNull();
  });

  it("pagamento e reemissão disputam o mesmo link e só um vence", async () => {
    const created = await makeLink(0);
    const results = await Promise.allSettled([
      pay(created.token, 34, "peer:192.0.2.340", payKey(34)),
      reissueSlotLink(shop.businessId, shop.ownerId, created.id, database),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [row] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    const links = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId));
    const payWon = results[0].status === "fulfilled";
    if (payWon) {
      expect(results[1]).toMatchObject({ reason: expect.objectContaining({ status: 409, code: "link_in_progress" }) });
      expect(row.status).toBe("pending");
      expect(row.replacedByLinkId).toBeNull();
      expect(links).toHaveLength(1);
      expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId))).toHaveLength(1);
    } else {
      expect(results[0]).toMatchObject({ reason: expect.objectContaining({ status: 409, code: "link_replaced" }) });
      expect(row.status).toBe("replaced");
      expect(links).toHaveLength(2);
      expect(links.filter((link) => link.status === "pending")).toHaveLength(1);
      expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, shop.businessId))).toHaveLength(0);
    }
  });

  it("apaga o lembrete depois do início e os links saem com o negócio", async () => {
    const created = await makeLink(0);
    const startsAt = new Date(Date.now() - 60_000);
    const expiresAt = new Date(startsAt.getTime() - 60_000);
    await database.update(schema.slotLinks).set({
      createdAt: new Date(expiresAt.getTime() - 60_000),
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      expiresAt,
      customerLabel: "Ana da mensagem",
    }).where(eq(schema.slotLinks.id, created.id));
    const future = await makeLink(1);
    expect(await purgeExpiredSlotLinkLabels(database)).toBeGreaterThanOrEqual(1);
    const [purged] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    const [kept] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, future.id));
    expect(purged.customerLabel).toBeNull();
    expect(kept.customerLabel).toBe("Ana da mensagem");
    const definition = await database.execute(sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'slot_links_business_id_businesses_id_fk'`);
    expect(String((definition.rows[0] as { def: string }).def)).toContain("ON DELETE CASCADE");
    expect(await deleteSlotLinksForBusiness(shop.businessId, database)).toBe(2);
    expect(await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.businessId, shop.businessId))).toHaveLength(0);
  });

  it("retoma o Pix começado antes da rotação quando PREVIOUS está definido", async () => {
    const oldSecret = "old-booking-access-secret-32chars-aaa";
    const nextSecret = "new-booking-access-secret-32chars-bbb";
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BETTER_AUTH_SECRET", "auth-secret-32-characters-long-ccccc");
    vi.stubEnv("BOOKING_ACCESS_SECRET", oldSecret);
    vi.stubEnv("BOOKING_ACCESS_SECRET_PREVIOUS", "");
    const created = await makeLink(2);
    const key = payKey(70);
    const first = await pay(created.token, 70, "peer:192.0.2.70", key);
    const oldHash = createHmac("sha256", oldSecret).update(slotLinkPayMessage(created.id, key)).digest("hex");
    const [before] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    expect(before.payIdempotencyHash).toBe(oldHash);

    vi.stubEnv("BOOKING_ACCESS_SECRET", nextSecret);
    vi.stubEnv("BOOKING_ACCESS_SECRET_PREVIOUS", oldSecret);
    const again = await pay(created.token, 70, "peer:192.0.2.71", key);
    expect(again.bookingId).toBe(first.bookingId);
    expect(again.payment?.id).toBe(first.payment?.id);
    const [after] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, created.id));
    const nextHash = createHmac("sha256", nextSecret).update(slotLinkPayMessage(created.id, key)).digest("hex");
    expect(after.payIdempotencyHash).toBe(oldHash);
    expect(after.payIdempotencyHash).not.toBe(nextHash);
    expect(again.accessToken).toBe(first.accessToken);
    const viewed = await getBookingPayment(shop.slug, again.bookingId, `Bearer ${again.accessToken}`, database);
    expect(viewed.bookingId).toBe(first.bookingId);
  });

  it("sem PREVIOUS a mesma chave não acha o Pix começado com o segredo antigo", async () => {
    const oldSecret = "old-booking-access-secret-32chars-aaa";
    const nextSecret = "new-booking-access-secret-32chars-bbb";
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BETTER_AUTH_SECRET", "auth-secret-32-characters-long-ccccc");
    vi.stubEnv("BOOKING_ACCESS_SECRET", oldSecret);
    vi.stubEnv("BOOKING_ACCESS_SECRET_PREVIOUS", "");
    const created = await makeLink(3);
    const key = payKey(71);
    await pay(created.token, 71, "peer:192.0.2.72", key);
    vi.stubEnv("BOOKING_ACCESS_SECRET", nextSecret);
    vi.stubEnv("BOOKING_ACCESS_SECRET_PREVIOUS", "");
    await expect(pay(created.token, 71, "peer:192.0.2.73", key)).rejects.toMatchObject({ status: 409, code: "link_in_progress" });
    expect(await database.select().from(schema.payments).where(eq(schema.payments.businessId, shop.businessId))).toHaveLength(1);
  });

  it("o link de acompanhamento segue válido depois da rotação sem PREVIOUS", async () => {
    const oldSecret = "old-booking-access-secret-32chars-aaa";
    const nextSecret = "new-booking-access-secret-32chars-bbb";
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BETTER_AUTH_SECRET", "auth-secret-32-characters-long-ccccc");
    vi.stubEnv("BOOKING_ACCESS_SECRET", oldSecret);
    vi.stubEnv("BOOKING_ACCESS_SECRET_PREVIOUS", "");
    const created = await makeLink(4);
    const paid = await pay(created.token, 74, "peer:192.0.2.74", payKey(74));
    vi.stubEnv("BOOKING_ACCESS_SECRET", nextSecret);
    const viewed = await getBookingPayment(shop.slug, paid.bookingId, `Bearer ${paid.accessToken}`, database);
    expect(viewed.bookingId).toBe(paid.bookingId);
    const resigned = signBookingAccessToken(shop.businessId, paid.bookingId);
    expect(resigned).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(getBookingPayment(shop.slug, paid.bookingId, `Bearer ${resigned}`, database)).rejects.toMatchObject({
      status: 404,
      code: "booking_not_found",
    });
  });

  it("agenda pausada recusa pagamento novo do link e solta o claim; retomada e Pix já pago seguem", async () => {
    const confirmed = await makeLink(0);
    const paid = await pay(confirmed.token, 80, "peer:192.0.2.90", payKey(80));
    const charge = provider.markPaid(paid.payment!.externalId!);
    await database.transaction(async (tx) => {
      const result = await applyPaidEvent(tx, "fake", polledPaidEvent(charge, hash), new Date());
      expect(result.outcome).toBe("processed");
    });
    const held = await makeLink(1);
    const hold = await pay(held.token, 81, "peer:192.0.2.91", payKey(81));
    const idle = await makeLink(2);
    await database.update(schema.businesses).set({ trialEndsAt: new Date("2020-01-01T00:00:00.000Z") }).where(eq(schema.businesses.id, shop.businessId));

    const opened = await openSlotLink(shop.slug, idle.token, "peer:192.0.2.92", database);
    expect(opened.bookingsPaused).toBe(true);
    expect(opened.status).toBe("pending");
    await expect(pay(idle.token, 82, "peer:192.0.2.93", payKey(82))).rejects.toMatchObject({ status: 403, code: "bookings_paused" });
    const [idleRow] = await database.select().from(schema.slotLinks).where(eq(schema.slotLinks.id, idle.id));
    expect(idleRow.payStartedAt).toBeNull();
    expect(idleRow.bookingId).toBeNull();
    expect(idleRow.payIdempotencyHash).toBeNull();
    await expect(createSlotLink(shop.businessId, shop.ownerId, {
      serviceId: shop.serviceId, date: DATE, time: clock(3),
    }, database)).rejects.toMatchObject({ status: 403, code: "bookings_paused" });
    await expect(reissueSlotLink(shop.businessId, shop.ownerId, idle.id, database)).rejects.toMatchObject({ status: 403, code: "bookings_paused" });

    const resumed = await pay(held.token, 81, "peer:192.0.2.94", payKey(81));
    expect(resumed.bookingId).toBe(hold.bookingId);
    const [booking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, paid.bookingId));
    expect(booking.status).toBe("confirmed");
    const listed = await dashboardBookings(shop.ownerId, shop.businessId, [DATE], database);
    expect(listed.bookings.some((row) => row.id === paid.bookingId && row.status === "confirmed")).toBe(true);
  });
});
