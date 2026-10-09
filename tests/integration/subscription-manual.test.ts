import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { getBookingAccess } from "../../lib/billing/access";
import { activateManualSubscription, listOpenSubscriptionRequests } from "../../lib/billing/activate";
import { runActivateCli } from "../../lib/billing/cli";
import { startSubscriptionCheckout, subscriptionCheckoutResponse } from "../../lib/billing/checkout";
import { addCalendarMonths } from "../../lib/billing/period";
import { getBusinessBilling } from "../../lib/billing/status";
import { createBooking, getAvailability } from "../../lib/bookings/service";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider } from "../../lib/payments/fake";
import { padraoPolicyHash } from "../helpers/deposit-policy";
import { insertConnectedMercadoPago } from "../helpers/connected-mp";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const provider = new FakePaymentProvider("test-only-webhook-secret-with-32-characters");
const number = "5500000000000";
const hours = "5";
const checkoutEnv = { SUPPORT_WHATSAPP_NUMBER: number, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: hours, BETTER_AUTH_URL: "http://localhost:3000" };
const now = new Date("2026-10-08T15:00:00.000Z");
const phone = "+5511999999999";

let ownerId: string;
let otherOwnerId: string;
let businessId: string;
let slug: string;
let serviceId: string;

const bookingInput = (startsAt: string) => ({
  serviceId,
  startsAt,
  customer: { name: "Cliente de teste", phone, cpfCnpj: "52998224725" },
  policyHash: padraoPolicyHash("Studio Bella"),
});

beforeEach(async () => {
  ownerId = randomUUID();
  otherOwnerId = randomUUID();
  businessId = randomUUID();
  serviceId = randomUUID();
  slug = `sub-${businessId}`;
  await database.insert(schema.user).values([
    { id: ownerId, name: "Dono", email: `${ownerId}@example.com` },
    { id: otherOwnerId, name: "Outro", email: `${otherOwnerId}@example.com` },
  ]);
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Studio Bella", slug, timezone: "America/Sao_Paulo" });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
  await insertConnectedMercadoPago(database, businessId);
});

afterEach(async () => {
  const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
  if (payments.length) await database.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
  await database.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
  await database.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
  await database.delete(schema.bookingRateLimits).where(eq(schema.bookingRateLimits.businessId, businessId));
  await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, businessId));
  await database.delete(schema.services).where(eq(schema.services.businessId, businessId));
  await database.delete(schema.subscriptionRequests).where(eq(schema.subscriptionRequests.businessId, businessId));
  await database.delete(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
  await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
  await database.delete(schema.user).where(eq(schema.user.id, otherOwnerId));
});
afterAll(async () => { await pool.end(); });

async function openRequests() {
  return database.select().from(schema.subscriptionRequests).where(eq(schema.subscriptionRequests.businessId, businessId));
}

describe("checkout manual da assinatura", () => {
  it("reaproveita o pedido aberto e separa 303 de JSON", async () => {
    const first = await startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now);
    const second = await startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now);
    expect(second.request).toEqual(first.request);
    expect(second.activationHours).toBe(5);
    expect(second.whatsappUrl).toBe(`https://wa.me/${number}?text=${encodeURIComponent(`Quero assinar o AgendaPix. Meu link: http://localhost:3000/${slug}`)}`);
    expect(await openRequests()).toHaveLength(1);

    const [raced] = await Promise.all([
      startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now),
      startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now),
    ]);
    expect(raced.request.id).toBe(first.request.id);
    expect(await openRequests()).toHaveLength(1);

    const form = subscriptionCheckoutResponse(new Request("http://localhost/checkout", { method: "POST", headers: { accept: "text/html" } }), first);
    expect(form.status).toBe(303);
    expect(form.headers.get("location")).toBe(first.whatsappUrl);
    const json = subscriptionCheckoutResponse(new Request("http://localhost/checkout", { method: "POST", headers: { accept: "application/json" } }), first);
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual(first);
  });

  it("responde 503 sem config e 409 só quando a assinatura active está longe do fim", async () => {
    await expect(startSubscriptionCheckout(businessId, ownerId, database, {}, now)).rejects.toMatchObject({ status: 503, code: "checkout_unavailable" });
    await expect(startSubscriptionCheckout(businessId, ownerId, database, { SUPPORT_WHATSAPP_NUMBER: number, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: hours }, now)).rejects.toMatchObject({ status: 503, code: "checkout_unavailable" });
    expect(await openRequests()).toHaveLength(0);
    await expect(startSubscriptionCheckout(businessId, otherOwnerId, database, checkoutEnv, now)).rejects.toMatchObject({ status: 404, code: "business_unavailable" });

    await database.insert(schema.subscriptions).values({ businessId, status: "active", provider: "manual", currentPeriodEnd: new Date("2026-10-13T02:59:59.000Z") });
    await expect(startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now)).rejects.toMatchObject({ status: 409, code: "subscription_already_active" });
    expect(await openRequests()).toHaveLength(0);

    await database.update(schema.subscriptions).set({ currentPeriodEnd: new Date("2026-10-12T02:59:59.000Z") }).where(eq(schema.subscriptions.businessId, businessId));
    const renewal = await startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now);
    expect(renewal.request.id).toBeTruthy();
    await database.delete(schema.subscriptionRequests).where(eq(schema.subscriptionRequests.businessId, businessId));
    await database.update(schema.subscriptions).set({ status: "trialing", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") }).where(eq(schema.subscriptions.businessId, businessId));
    expect((await startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now)).provider).toBe("manual");
  });

  it("expõe checkout no billing, inclusive pedido aberto sem config", async () => {
    expect((await getBusinessBilling(businessId, ownerId, database, {})).checkout).toEqual({
      provider: "manual",
      available: false,
      unavailableReason: "config_missing",
      activationHours: null,
      pendingRequest: null,
    });
    const started = await startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now);
    const ready = await getBusinessBilling(businessId, ownerId, database, checkoutEnv);
    expect(ready.checkout).toEqual({
      provider: "manual",
      available: true,
      unavailableReason: null,
      activationHours: 5,
      pendingRequest: started.request,
    });
    const hidden = await getBusinessBilling(businessId, ownerId, database, {});
    expect(hidden.checkout).toMatchObject({ available: false, unavailableReason: "config_missing", activationHours: null, pendingRequest: started.request });
    expect(ready.plan).toEqual({ name: "AgendaPix", priceCents: 4900 });
  });
});

describe("script admin e fim do período", () => {
  it("dry-run não grava, ativar tira a pausa e o fim do período pausa de novo", async () => {
    await database.update(schema.businesses).set({ trialEndsAt: new Date("2020-01-01T00:00:00.000Z") }).where(eq(schema.businesses.id, businessId));
    await startSubscriptionCheckout(businessId, ownerId, database, checkoutEnv, now);
    await expect(createBooking(slug, bookingInput("2030-01-01T12:00:00Z"), randomUUID(), database, provider)).rejects.toMatchObject({ status: 403, code: "bookings_paused" });

    const logs: string[] = [];
    const dry = await activateManualSubscription(database, { business: slug, months: 1, by: "ops", dryRun: true }, { now, log: (line) => logs.push(line) });
    expect(dry.dryRun).toBe(true);
    expect(logs[0]).toContain("subscription_activation_dry_run");
    expect(await database.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId))).toHaveLength(0);
    expect((await openRequests())[0]?.handledAt).toBeNull();
    expect((await listOpenSubscriptionRequests(database)).some((row) => row.businessId === businessId)).toBe(true);

    await expect(runActivateCli(["--business", businessId, "--by", "ops", "--months", "2", "--dry-run"], process.env, database)).resolves.toMatchObject({ dryRun: true, months: 2 });
    expect(await database.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId))).toHaveLength(0);

    const activated = await activateManualSubscription(database, { business: slug, months: 1, by: "ops", dryRun: false }, { now, log: (line) => logs.push(line) });
    expect(activated.currentPeriodEnd).toBe(addCalendarMonths(now, 1, "America/Sao_Paulo").toISOString());
    expect(logs.at(-1)).toContain("subscription_activated");
    const [subscription] = await database.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
    expect(subscription).toMatchObject({ status: "active", provider: "manual" });
    expect(subscription?.currentPeriodEnd?.toISOString()).toBe(activated.currentPeriodEnd);
    expect((await openRequests())[0]?.handledBy).toBe("ops");
    expect((await listOpenSubscriptionRequests(database)).some((row) => row.businessId === businessId)).toBe(false);
    expect(getBookingAccess({ trialEndsAt: new Date("2020-01-01T00:00:00.000Z"), timezone: "America/Sao_Paulo" }, { status: "active", currentPeriodEnd: subscription!.currentPeriodEnd }, now).bookingsPaused).toBe(false);

    const resumed = await createBooking(slug, bookingInput("2030-01-01T12:00:00Z"), randomUUID(), database, provider);
    expect(resumed.data.status).toBe("pending_payment");

    await database.update(schema.subscriptions).set({ currentPeriodEnd: new Date("2020-02-01T00:00:00.000Z") }).where(eq(schema.subscriptions.businessId, businessId));
    await expect(createBooking(slug, bookingInput("2030-01-01T13:00:00Z"), randomUUID(), database, provider)).rejects.toMatchObject({ status: 403, code: "bookings_paused" });
    expect(await getAvailability(slug, { serviceId, date: "2030-01-01" }, database)).toMatchObject({ slots: [], bookingsPaused: true });
    expect((await getBusinessBilling(businessId, ownerId, database, checkoutEnv)).bookingsPaused).toBe(true);
  });

  it("estende o período vigente e, se já acabou, conta de agora", async () => {
    const currentPeriodEnd = new Date("2026-11-19T02:59:59.000Z");
    await database.insert(schema.subscriptions).values({ businessId, status: "active", provider: "manual", currentPeriodEnd });
    const extended = await activateManualSubscription(database, { business: businessId, months: 1, by: "ops", dryRun: false }, { now, log: () => {} });
    expect(extended.previousPeriodEnd).toBe(currentPeriodEnd.toISOString());
    expect(extended.currentPeriodEnd).toBe(addCalendarMonths(currentPeriodEnd, 1, "America/Sao_Paulo").toISOString());

    await database.update(schema.subscriptions).set({ status: "past_due", currentPeriodEnd: new Date("2026-12-19T02:59:59.000Z") }).where(eq(schema.subscriptions.businessId, businessId));
    const restarted = await activateManualSubscription(database, { business: slug, months: 1, by: "ops", dryRun: false }, { now, log: () => {} });
    expect(restarted.previousPeriodEnd).toBeNull();
    expect(restarted.currentPeriodEnd).toBe(addCalendarMonths(now, 1, "America/Sao_Paulo").toISOString());
  });
});
