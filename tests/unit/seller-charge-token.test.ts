import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptMpToken } from "../../lib/mercadopago-oauth/crypto";
import { findBusinessIdByMpUserId, getSellerAccessToken, getSellerAccessTokenForSettlement } from "../../lib/mercadopago-oauth/credentials";
import { createMemoryMpStore } from "../../lib/mercadopago-oauth/memory-store";
import type { MpConnection } from "../../lib/mercadopago-oauth/types";
import { buildMercadoPagoManifest, MercadoPagoPaymentProvider, signMercadoPagoWebhook } from "../../lib/payments/mercadopago";
import { IgnoredWebhookEvent } from "../../lib/payments/provider";
import { registerSellerAccountHooks } from "../../lib/payments/register-seller-hooks";
import { MpAccountNotConnectedError, resetSellerAccountHooks, resolveMpAccessToken, sellerHooksActive, setSellerAccountHooks } from "../../lib/payments/seller-account";

const platformToken = "TEST-platform-token-not-the-seller";
const webhookSecret = "test-only-mercadopago-webhook-secret-32chars";
const key = "ab".repeat(32);
const businessA = "11111111-1111-4111-8111-111111111111";
const businessB = "22222222-2222-4222-8222-222222222222";
const tokenA = "APP_USR-seller-a-token";
const tokenB = "APP_USR-seller-b-token";
const now = new Date("2030-01-01T12:00:00.000Z");
const env = {
  MP_CLIENT_ID: "mp-client",
  MP_CLIENT_SECRET: "mp-client-secret",
  MP_OAUTH_REDIRECT_URI: "https://app.example.com/api/integrations/mercadopago/callback",
  MP_TOKEN_ENCRYPTION_KEY: key,
  BETTER_AUTH_URL: "https://app.example.com",
  BETTER_AUTH_SECRET: "c".repeat(40),
  MERCADOPAGO_ACCESS_TOKEN: platformToken,
  MERCADOPAGO_WEBHOOK_SECRET: webhookSecret,
};

type Call = { method: string; url: string; authorization: string | null };

function connection(businessId: string, accessToken: string, mpUserId: string): MpConnection {
  return {
    businessId,
    mpUserId,
    accessTokenEnc: encryptMpToken(accessToken, businessId, "access", key),
    refreshTokenEnc: encryptMpToken(`refresh-${mpUserId}`, businessId, "refresh", key),
    publicKey: null,
    scope: null,
    liveMode: false,
    expiresAt: new Date("2030-06-01T00:00:00.000Z"),
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    refreshedAt: null,
    status: "connected",
    lastError: null,
    disconnectedAt: null,
    consentVersion: null,
    consentTextSha256: null,
    autoRefundAckAt: null,
    consentUserId: null,
    accountDisplayName: null,
    accountEmailMasked: null,
  };
}

function providerFor(store: ReturnType<typeof createMemoryMpStore>) {
  setSellerAccountHooks({
    getSellerAccessToken: (businessId) => getSellerAccessToken(businessId, { store, env, now }),
    getSellerAccessTokenForSettlement: (businessId) => getSellerAccessTokenForSettlement(businessId, { store, env }),
    findBusinessIdByMpUserId: (mpUserId) => findBusinessIdByMpUserId(mpUserId, { store }),
  });
  const calls: Call[] = [];
  const payments = new Map<string, Record<string, unknown>>();
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const authorization = new Headers(init?.headers).get("authorization");
    calls.push({ method, url: url.pathname + url.search, authorization });
    if (method === "GET" && url.pathname === "/v1/payments/search") {
      const reference = url.searchParams.get("external_reference");
      const found = reference ? payments.get(reference) : undefined;
      return Response.json({ results: found ? [found] : [] });
    }
    if (method === "POST" && url.pathname === "/v1/payments") {
      const body = JSON.parse(String(init?.body)) as { external_reference: string; transaction_amount: number; date_of_expiration: string };
      const payment = {
        id: String(1000 + payments.size),
        status: "pending",
        status_detail: "pending_waiting_transfer",
        external_reference: body.external_reference,
        transaction_amount: body.transaction_amount,
        date_of_expiration: body.date_of_expiration,
        date_created: now.toISOString(),
        point_of_interaction: { transaction_data: { qr_code: "000201", qr_code_base64: "", ticket_url: null } },
      };
      payments.set(body.external_reference, payment);
      return Response.json(payment);
    }
    if (method === "GET" && url.pathname.startsWith("/v1/payments/")) {
      const id = url.pathname.split("/").pop();
      const found = [...payments.values()].find((payment) => payment.id === id);
      if (!found) return Response.json({ message: "not found" }, { status: 404 });
      return Response.json(found);
    }
    if (method === "POST" && url.pathname.endsWith("/refunds")) {
      return Response.json({ id: 9, status: "approved" });
    }
    return Response.json({ message: "unexpected" }, { status: 500 });
  });
  const provider = new MercadoPagoPaymentProvider({
    accessToken: platformToken,
    webhookSecret,
    baseUrl: "https://api.mercadopago.com",
    notificationUrl: "https://app.example.com/api/webhooks/payments/mercadopago",
    fetchImpl,
    now: () => now,
    resolveAccessToken: (query) => resolveMpAccessToken(query, env),
  });
  return { provider, calls, payments };
}

function chargeInput(amount = 1000) {
  return {
    idempotencyKey: randomUUID(),
    reference: randomUUID(),
    amountCents: amount,
    expiresAt: new Date(now.getTime() + 40 * 60_000),
    customer: { name: "Cliente Teste", phone: "+5511999999999" },
  };
}

afterEach(() => {
  resetSellerAccountHooks();
});

describe("token OAuth do vendedor na cobrança Pix", () => {
  it("registra os ganchos no boot e a cobrança usa o token daquele vendedor", async () => {
    expect(sellerHooksActive()).toBe(false);
    registerSellerAccountHooks();
    expect(sellerHooksActive()).toBe(true);
    resetSellerAccountHooks();

    const store = createMemoryMpStore([
      connection(businessA, tokenA, "1001"),
      connection(businessB, tokenB, "1002"),
    ]);
    const { provider, calls, payments } = providerFor(store);
    const createdA = await provider.createPixCharge(chargeInput(), { businessId: businessA });
    const createdB = await provider.createPixCharge(chargeInput(1500), { businessId: businessB });
    const authorizations = calls.map((call) => call.authorization);
    expect(authorizations.every((value) => value !== `Bearer ${platformToken}`)).toBe(true);
    expect(calls.filter((call) => call.method === "POST" && call.url === "/v1/payments").map((call) => call.authorization)).toEqual([
      `Bearer ${tokenA}`,
      `Bearer ${tokenB}`,
    ]);

    payments.get([...payments.keys()][0]!)!.status = "approved";
    payments.get([...payments.keys()][0]!)!.status_detail = "accredited";
    await provider.refundCharge(createdA.externalId, { idempotencyKey: randomUUID() }, { businessId: businessA });
    const refund = calls.find((call) => call.url.endsWith("/refunds"));
    expect(refund?.authorization).toBe(`Bearer ${tokenA}`);

    const body = JSON.stringify({ id: 7, type: "payment", action: "payment.updated", user_id: 1002, data: { id: createdB.externalId } });
    const ts = String(Math.floor(now.getTime() / 1000));
    const manifest = buildMercadoPagoManifest({ dataId: createdB.externalId, requestId: "req", ts });
    const headers = new Headers({
      "x-signature": `ts=${ts},v1=${signMercadoPagoWebhook(manifest, webhookSecret)}`,
      "x-request-id": "req",
    });
    await expect(provider.verifyWebhook(body, headers, now, `http://localhost/api/webhooks/payments/mercadopago?data.id=${createdB.externalId}&type=payment`)).rejects.toBeInstanceOf(IgnoredWebhookEvent);
    const webhookGet = calls.filter((call) => call.method === "GET" && call.url === `/v1/payments/${createdB.externalId}`);
    expect(webhookGet.at(-1)?.authorization).toBe(`Bearer ${tokenB}`);

    const polled = await provider.getCharge(createdA.externalId, { businessId: businessA });
    expect(polled?.externalId).toBe(createdA.externalId);
    expect(calls.filter((call) => call.url === `/v1/payments/${createdA.externalId}`).at(-1)?.authorization).toBe(`Bearer ${tokenA}`);
  });

  it("negócio sem conexão não usa o token da plataforma", async () => {
    const { provider } = providerFor(createMemoryMpStore());
    await expect(provider.createPixCharge(chargeInput(), { businessId: businessA })).rejects.toBeInstanceOf(MpAccountNotConnectedError);
    await expect(provider.getCharge("1001", { businessId: businessA })).rejects.toBeInstanceOf(MpAccountNotConnectedError);
    await expect(provider.getCharge("1001", { mpUserId: "1001" })).rejects.toBeInstanceOf(MpAccountNotConnectedError);
  });
});
