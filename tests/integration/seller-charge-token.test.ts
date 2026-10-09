import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { createBooking, listPublicServices } from "../../lib/bookings/service";
import { databaseEnvSchema } from "../../lib/env";
import { MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import { encryptMpToken } from "../../lib/mercadopago-oauth/crypto";
import { buildMercadoPagoManifest, MercadoPagoPaymentProvider, signMercadoPagoWebhook, type MercadoPagoFetch } from "../../lib/payments/mercadopago";
import { IgnoredWebhookEvent } from "../../lib/payments/provider";
import { paymentsConfig } from "../../lib/payments/config";
import { reconcileOnce } from "../../lib/payments/reconcile";
import { registerSellerAccountHooks } from "../../lib/payments/register-seller-hooks";
import { resolveMpAccessToken, resetSellerAccountHooks } from "../../lib/payments/seller-account";
import { padraoPolicyHash } from "../helpers/deposit-policy";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const key = "ab".repeat(32);
const platformToken = "TEST-platform-token-not-the-seller";
const sellerToken = "APP_USR-seller-db-token";
const webhookSecret = "d".repeat(40);
const now = new Date("2030-01-01T15:00:00.000Z");

let ownerId: string;
let businessId: string;
let slug: string;
let serviceId: string;

function oauthEnv() {
  vi.stubEnv("MP_CLIENT_ID", "mp-client");
  vi.stubEnv("MP_CLIENT_SECRET", "mp-client-secret");
  vi.stubEnv("MP_OAUTH_REDIRECT_URI", "https://app.example.com/api/integrations/mercadopago/callback");
  vi.stubEnv("MP_TOKEN_ENCRYPTION_KEY", key);
  vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
  vi.stubEnv("BETTER_AUTH_SECRET", "c".repeat(40));
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", platformToken);
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", webhookSecret);
  vi.stubEnv("MP_OAUTH_PKCE", "off");
}

async function insertSeller(mpUserId: string, accessToken: string, consentOrLive: string | boolean | null = MP_CONNECT_CONSENT_VERSION) {
  const liveMode = typeof consentOrLive === "boolean" ? consentOrLive : null;
  const consentVersion = typeof consentOrLive === "string" || consentOrLive === null ? consentOrLive : MP_CONNECT_CONSENT_VERSION;
  await database.insert(schema.mercadopagoConnections).values({
    businessId,
    mpUserId,
    accessTokenEnc: encryptMpToken(accessToken, businessId, "access", key),
    refreshTokenEnc: encryptMpToken(`refresh-${mpUserId}`, businessId, "refresh", key),
    liveMode,
    expiresAt: new Date("2030-06-01T00:00:00.000Z"),
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    status: "connected",
    consentVersion,
    consentTextSha256: consentVersion ? createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex") : null,
    autoRefundAckAt: consentVersion ? new Date("2026-10-09T12:00:00.000Z") : null,
    consentUserId: consentVersion ? ownerId : null,
  });
}

beforeEach(async () => {
  oauthEnv();
  ownerId = randomUUID();
  businessId = randomUUID();
  serviceId = randomUUID();
  slug = `seller-${businessId.slice(0, 8)}`;
  await database.insert(schema.user).values({ id: ownerId, name: "Dono", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Negócio", slug });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
});

afterEach(async () => {
  resetSellerAccountHooks();
  vi.unstubAllEnvs();
  await database.delete(schema.paymentAudit).where(eq(schema.paymentAudit.businessId, businessId));
  await database.delete(schema.paymentEvents).where(eq(schema.paymentEvents.provider, "mercadopago"));
  await database.delete(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.provider, "mercadopago"));
  await database.delete(schema.providerChargeReferences).where(eq(schema.providerChargeReferences.provider, "mercadopago"));
  await database.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
  await database.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
  await database.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
  await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, businessId));
  await database.delete(schema.services).where(eq(schema.services.businessId, businessId));
  await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
});

afterAll(async () => {
  await pool.end();
});

function mpProvider(fetchImpl: MercadoPagoFetch, clock: () => Date = () => new Date()) {
  registerSellerAccountHooks();
  return new MercadoPagoPaymentProvider({
    accessToken: platformToken,
    webhookSecret,
    baseUrl: "https://api.mercadopago.com",
    notificationUrl: "https://app.example.com/api/webhooks/payments/mercadopago",
    fetchImpl,
    now: clock,
    resolveAccessToken: (query) => resolveMpAccessToken(query),
  });
}

describe("token do vendedor no banco", () => {
  it("cobra com o token cifrado daquele negócio e não com o da plataforma", async () => {
    await insertSeller("424242", sellerToken);
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url.pathname} ${new Headers(init?.headers).get("authorization")}`);
      if (method === "GET" && url.pathname === "/v1/payments/search") return Response.json({ results: [] });
      if (method === "POST" && url.pathname === "/v1/payments") {
        const body = JSON.parse(String(init?.body)) as { external_reference: string; transaction_amount: number; date_of_expiration: string };
        return Response.json({
          id: "9001",
          status: "pending",
          status_detail: "pending_waiting_transfer",
          external_reference: body.external_reference,
          transaction_amount: body.transaction_amount,
          date_of_expiration: body.date_of_expiration,
          date_created: now.toISOString(),
          point_of_interaction: { transaction_data: { qr_code: "000201", qr_code_base64: "", ticket_url: null } },
        });
      }
      return Response.json({ message: "unexpected" }, { status: 500 });
    });
    const listed = await listPublicServices(slug, database);
    expect(listed.services[0]).toMatchObject({ bookable: true, blockedReason: null });
    const provider = mpProvider(fetchImpl);
    const created = await createBooking(slug, {
      serviceId,
      startsAt: new Date(Date.UTC(2030, 0, 1, 12, 0)).toISOString(),
      customer: { name: "Cliente", phone: "+5511999999901" },
      policyHash: padraoPolicyHash("Negócio"),
    }, randomUUID(), database, provider);
    expect(created.data.payment?.externalId).toBe("9001");
    expect(calls.some((call) => call.includes(platformToken))).toBe(false);
    expect(calls).toContain(`POST /v1/payments Bearer ${sellerToken}`);
  });

  it("conta de teste não reserva quando o app e o Mercado Pago estão em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MERCADOPAGO_ENV", "production");
    await insertSeller("616161", sellerToken, false);
    const listed = await listPublicServices(slug, database);
    expect(listed.services[0]).toMatchObject({ bookable: false, blockedReason: "mp_account_test_mode" });
    await expect(createBooking(slug, {
      serviceId,
      startsAt: new Date(Date.UTC(2030, 0, 1, 14, 0)).toISOString(),
      customer: { name: "Cliente", phone: "+5511999999904" },
      policyHash: padraoPolicyHash("Negócio"),
    }, randomUUID(), database)).rejects.toMatchObject({ status: 409, code: "mp_account_test_mode" });
  });

  it("conta de teste continua na listagem em sandbox", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MERCADOPAGO_ENV", "sandbox");
    await insertSeller("616162", sellerToken, false);
    const listed = await listPublicServices(slug, database);
    expect(listed.services[0]).toMatchObject({ bookable: true, blockedReason: null });
  });

  it("negócio sem conexão recebe 409 e a listagem fica bloqueada", async () => {
    const listed = await listPublicServices(slug, database);
    expect(listed.services[0]).toMatchObject({ bookable: false, blockedReason: "mp_account_not_connected" });
    await expect(createBooking(slug, {
      serviceId,
      startsAt: new Date(Date.UTC(2030, 0, 1, 12, 30)).toISOString(),
      customer: { name: "Cliente", phone: "+5511999999902" },
      policyHash: padraoPolicyHash("Negócio"),
    }, randomUUID(), database)).rejects.toMatchObject({ status: 409, code: "mp_account_not_connected" });
  });

  it("consentimento antigo bloqueia reserva nova e a listagem", async () => {
    await insertSeller("616161", sellerToken, "2026-09-01.v1");
    const listed = await listPublicServices(slug, database);
    expect(listed.services[0]).toMatchObject({ bookable: false, blockedReason: "mp_consent_outdated" });
    await expect(createBooking(slug, {
      serviceId,
      startsAt: new Date(Date.UTC(2030, 0, 1, 14, 0)).toISOString(),
      customer: { name: "Cliente", phone: "+5511999999904" },
      policyHash: padraoPolicyHash("Negócio"),
    }, randomUUID(), database)).rejects.toMatchObject({ status: 409, code: "mp_consent_outdated" });
  });

  it("webhook e reconcile usam o token do vendedor daquele pagamento", async () => {
    await insertSeller("515151", sellerToken, "2026-09-01.v1");
    const externalId = `pay-${businessId.slice(0, 8)}`;
    const customerId = randomUUID();
    const bookingId = randomUUID();
    const paymentId = randomUUID();
    const startsAt = new Date(Date.UTC(2030, 0, 1, 13, 0));
    await database.insert(schema.customers).values({ id: customerId, businessId, name: "Cliente", phone: "+5511999999903" });
    await database.insert(schema.bookings).values({
      id: bookingId,
      businessId,
      serviceId,
      customerId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      priceCents: 5000,
      depositCents: 1000,
      status: "pending_payment",
      expiresAt: new Date(now.getTime() + 20 * 60_000),
    });
    await database.insert(schema.payments).values({
      id: paymentId,
      businessId,
      bookingId,
      provider: "mercadopago",
      externalId,
      qrCodeDataUrl: "data:image/png;base64,aaa",
      copyPaste: "000201",
      idempotencyKey: randomUUID(),
      amountCents: 1000,
      status: "pending",
      expiresAt: new Date(now.getTime() + 20 * 60_000),
    });
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      calls.push(`${init?.method ?? "GET"} ${url.pathname} ${new Headers(init?.headers).get("authorization")}`);
      return Response.json({
        id: externalId,
        status: "pending",
        status_detail: "pending_waiting_transfer",
        external_reference: paymentId,
        transaction_amount: 10,
        date_of_expiration: new Date(now.getTime() + 22 * 60_000).toISOString(),
        date_created: now.toISOString(),
        point_of_interaction: { transaction_data: { qr_code: "000201" } },
      });
    });
    const provider = mpProvider(fetchImpl, () => now);
    const ts = String(Math.floor(now.getTime() / 1000));
    const manifest = buildMercadoPagoManifest({ dataId: externalId, requestId: "req-db", ts });
    await expect(provider.verifyWebhook(
      JSON.stringify({ id: 8, type: "payment", action: "payment.updated", user_id: "515151", data: { id: externalId } }),
      new Headers({ "x-signature": `ts=${ts},v1=${signMercadoPagoWebhook(manifest, webhookSecret)}`, "x-request-id": "req-db" }),
      now,
      `http://localhost/api/webhooks/payments/mercadopago?data.id=${externalId}&type=payment`,
    )).rejects.toBeInstanceOf(IgnoredWebhookEvent);
    const pooled = Object.assign(drizzle(pool, { schema }), { $client: pool });
    await reconcileOnce(pooled, provider, paymentsConfig(), now);
    expect(calls.some((call) => call.includes(platformToken))).toBe(false);
    expect(calls.filter((call) => call.startsWith(`GET /v1/payments/${externalId} Bearer ${sellerToken}`)).length).toBeGreaterThanOrEqual(2);
  });
});
