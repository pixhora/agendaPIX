import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { getBookingAccess } from "../../lib/billing/access";
import { getBusinessBilling } from "../../lib/billing/status";
import { createBooking, getAvailability, getBookingPayment, listPublicServices } from "../../lib/bookings/service";
import { countFutureConfirmedBookings, dashboardServices, saveContactWhatsapp, saveDashboardService } from "../../lib/dashboard/data";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider, signFakeWebhook } from "../../lib/payments/fake";
import { processWebhook } from "../../lib/payments/webhook";
import { FLEXIVEL_DEPOSIT_POLICY, PADRAO_DEPOSIT_POLICY } from "../../lib/policy/schema";
import { policyHashFor } from "../../lib/policy/hash";
import { padraoPolicyHash } from "../helpers/deposit-policy";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const secret = "test-only-webhook-secret-with-32-characters";
const provider = new FakePaymentProvider(secret);
let ownerId: string;
let businessId: string;
let slug: string;
let serviceId: string;
const phone = "+5511999999999";
const input = (overrides: Record<string, unknown> = {}) => ({
  serviceId,
  startsAt: "2030-01-01T12:00:00Z",
  customer: { name: "Cliente de teste", phone, cpfCnpj: "52998224725" },
  policyHash: padraoPolicyHash("Studio Bella"),
  ...overrides,
});

beforeEach(async () => {
  ownerId = randomUUID();
  businessId = randomUUID();
  serviceId = randomUUID();
  slug = `policy-${businessId}`;
  await database.insert(schema.user).values({ id: ownerId, name: "Dono", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Studio Bella", slug, contactWhatsapp: "+5511988887777" });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
});

afterEach(async () => {
  const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
  const externalIds = payments.flatMap((payment) => payment.externalId ? [payment.externalId] : []);
  if (externalIds.length) {
    const events = await database.select().from(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
    const eventIds = events.map((event) => event.eventId);
    if (eventIds.length) await database.delete(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.eventId, eventIds));
    await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
  }
  await database.delete(schema.paymentAudit).where(eq(schema.paymentAudit.businessId, businessId));
  await database.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
  await database.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
  await database.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
  await database.delete(schema.bookingRateLimits).where(eq(schema.bookingRateLimits.businessId, businessId));
  await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, businessId));
  await database.delete(schema.services).where(eq(schema.services.businessId, businessId));
  await database.delete(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
});
afterAll(async () => { await pool.end(); });

describe("política do sinal, teste grátis e WhatsApp", () => {
  it("publica a política, grava o snapshot e recusa hash antigo", async () => {
    const listed = await listPublicServices(slug, database);
    expect(listed.address).toBeNull();
    expect(listed.phone).toBeNull();
    expect(listed.logoUrl).toBeNull();
    expect(listed.contactWhatsapp).toBe("+5511988887777");
    expect(listed.bookingsPaused).toBe(false);
    expect(listed.services[0]).toMatchObject({ depositPolicy: PADRAO_DEPOSIT_POLICY, policyHash: padraoPolicyHash("Studio Bella") });

    const created = await createBooking(slug, input(), randomUUID(), database, provider);
    expect(created.data.policy?.text).toContain("Studio Bella pode devolver o sinal até");
    expect(created.data.policy?.text).not.toMatch(/painel|Devolver pelo AgendaPix|pelo AgendaPix/);
    expect(created.data.policy?.text?.toLowerCase()).not.toContain("repass");
    const viewed = await getBookingPayment(slug, created.data.bookingId, `Bearer ${created.data.accessToken}`, database);
    expect(viewed.policy?.text).toBe(created.data.policy?.text);
    expect(created.data.policy?.snapshot).toMatchObject(PADRAO_DEPOSIT_POLICY);

    await expect(createBooking(slug, input({ policyHash: "a".repeat(64) }), randomUUID(), database, provider)).rejects.toMatchObject({
      status: 409,
      code: "policy_changed",
      details: { policyHash: padraoPolicyHash("Studio Bella"), depositPolicy: PADRAO_DEPOSIT_POLICY },
    });
    await expect(createBooking(slug, input({ policyHash: undefined }), randomUUID(), database, provider)).rejects.toMatchObject({ status: 400, code: "invalid_input" });

    await saveDashboardService(ownerId, {
      businessId, id: serviceId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000, active: true, depositPolicy: FLEXIVEL_DEPOSIT_POLICY,
    }, database);
    const [saved] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, created.data.bookingId));
    expect(saved.policySnapshot).toMatchObject(PADRAO_DEPOSIT_POLICY);
    const nextHash = policyHashFor(FLEXIVEL_DEPOSIT_POLICY, { businessName: "Studio Bella", depositCents: 1000 });
    expect((await listPublicServices(slug, database)).services[0].policyHash).toBe(nextHash);
  });

  it("serviço sem sinal não guarda snapshot e reserva sem chave Pix", async () => {
    await database.update(schema.services).set({ depositCents: 0 }).where(eq(schema.services.id, serviceId));
    const { data } = await createBooking(slug, { serviceId, startsAt: "2030-01-01T12:00:00Z", customer: { name: "Cliente", phone, cpfCnpj: "52998224725" } }, randomUUID(), database, provider);
    expect(data.status).toBe("confirmed");
    expect(data.policy).toBeNull();
    const [row] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId));
    expect(row.policySnapshot).toBeNull();
    expect(row.policyHash).toBeNull();
  });

  it("pausa novos agendamentos no fim do teste, sem bloquear replay nem Pix já gerado", async () => {
    const key = randomUUID();
    const first = await createBooking(slug, input(), key, database, provider);
    await database.update(schema.businesses).set({ trialEndsAt: new Date(Date.now() - 1000) }).where(eq(schema.businesses.id, businessId));
    const replay = await createBooking(slug, input(), key, database, provider);
    expect(replay.replayed).toBe(true);
    await expect(createBooking(slug, input({ startsAt: "2030-01-01T12:30:00Z", customer: { name: "Outro", phone: "+5511999999901", cpfCnpj: "52998224725" } }), randomUUID(), database, provider))
      .rejects.toMatchObject({ status: 403, code: "bookings_paused" });
    const limits = await database.select().from(schema.bookingRateLimits).where(eq(schema.bookingRateLimits.businessId, businessId));
    expect(limits).toHaveLength(1);
    expect(limits[0]?.attempts).toBe(2);

    const availability = await getAvailability(slug, { serviceId, date: "2030-01-01" }, database);
    expect(availability).toMatchObject({ slots: [], bookingsPaused: true });
    expect((await listPublicServices(slug, database)).bookingsPaused).toBe(true);

    const body = JSON.stringify({ eventId: randomUUID(), type: "payment.paid", externalId: first.data.payment!.externalId, amountCents: 1000, paidAt: new Date().toISOString() });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const request = new Request("http://localhost/api/webhooks/payments/fake", {
      method: "POST",
      headers: { "content-type": "application/json", "x-fake-timestamp": timestamp, "x-fake-signature": signFakeWebhook(body, timestamp, secret) },
      body,
    });
    await processWebhook(request, "fake", database, provider);
    expect((await getBookingPayment(slug, first.data.bookingId, `Bearer ${first.data.accessToken}`, database)).status).toBe("confirmed");

    await database.insert(schema.subscriptions).values({ businessId, status: "active", currentPeriodEnd: new Date(Date.now() + 86_400_000) });
    const resumed = await createBooking(slug, input({ startsAt: "2030-01-01T13:00:00Z", customer: { name: "Novo", phone: "+5511999999902", cpfCnpj: "52998224725" } }), randomUUID(), database, provider);
    expect(resumed.data.status).toBe("pending_payment");
  });

  it("expõe bookable, contagem futura e cobrança do teste ao dono", async () => {
    expect((await dashboardServices(ownerId, businessId, database))[0]).toMatchObject({ bookable: true, blockedReason: null });
    await database.insert(schema.bookings).values({
      businessId, serviceId, customerId: (await database.insert(schema.customers).values({ businessId, name: "Futuro", phone: "+5511999999903" }).returning())[0].id,
      startsAt: new Date("2030-06-01T15:00:00Z"), endsAt: new Date("2030-06-01T15:30:00Z"), priceCents: 5000, depositCents: 1000, status: "confirmed",
    });
    expect(await countFutureConfirmedBookings(ownerId, businessId, serviceId, database, new Date("2030-01-01T00:00:00Z"))).toEqual({ count: 1 });
    await database.update(schema.businesses).set({ trialEndsAt: new Date("2020-01-01T00:00:00.000Z") }).where(eq(schema.businesses.id, businessId));
    expect((await dashboardServices(ownerId, businessId, database))[0]).toMatchObject({ bookable: false, blockedReason: "bookings_paused" });
    const billing = await getBusinessBilling(businessId, ownerId, database);
    expect(billing).toMatchObject({ state: "paused", bookingsPaused: true, plan: { name: "AgendaPix", priceCents: 4900 }, subscription: null });
    expect(getBookingAccess({ trialEndsAt: billing.trialEndsAt, timezone: "America/Sao_Paulo" }, null, new Date()).bookingsPaused).toBe(true);
    expect(await saveContactWhatsapp(ownerId, businessId, "11 98888-7777", database)).toEqual({ contactWhatsapp: "+5511988887777" });
    await expect(countFutureConfirmedBookings(ownerId, businessId, randomUUID(), database)).rejects.toMatchObject({ status: 404 });
    expect(await database.select({ id: schema.businessPixKeys.businessId }).from(schema.businessPixKeys).where(inArray(schema.businessPixKeys.businessId, [businessId]))).toEqual([]);
  });
});
