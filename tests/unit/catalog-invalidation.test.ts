import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptMpToken } from "../../lib/mercadopago-oauth/crypto";
import { mercadoPagoManifest, handleMpConnectWebhook } from "../../lib/mercadopago-oauth/connect-webhook";
import { createMemoryMpStore } from "../../lib/mercadopago-oauth/memory-store";
import { createMemoryWebhookEvents } from "../../lib/mercadopago-oauth/webhook-events";
import { refreshMercadoPagoConnection } from "../../lib/mercadopago-oauth/refresh";
import type { MpConnection } from "../../lib/mercadopago-oauth/types";

const revalidateTag = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}));

vi.mock("../../db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ slug: "studio" }],
        }),
      }),
    }),
  }),
}));

const businessId = "11111111-1111-4111-8111-111111111111";
const key = "ab".repeat(32);
const webhookSecret = "d".repeat(40);
const now = new Date("2026-10-08T12:00:00.000Z");
const env = {
  MP_CLIENT_ID: "mp-client",
  MP_CLIENT_SECRET: "mp-client-secret",
  MP_OAUTH_REDIRECT_URI: "https://app.example.com/api/integrations/mercadopago/callback",
  MP_TOKEN_ENCRYPTION_KEY: key,
  BETTER_AUTH_URL: "https://app.example.com",
  BETTER_AUTH_SECRET: "c".repeat(40),
  MERCADOPAGO_WEBHOOK_SECRET: webhookSecret,
};

function connection(overrides: Partial<MpConnection> = {}): MpConnection {
  return {
    businessId,
    mpUserId: "4242",
    accessTokenEnc: encryptMpToken("seller-access", businessId, "access", key),
    refreshTokenEnc: encryptMpToken("seller-refresh", businessId, "refresh", key),
    publicKey: "public-test",
    scope: "read write offline_access",
    liveMode: false,
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    refreshedAt: null,
    status: "connected",
    lastError: null,
    disconnectedAt: null,
    consentVersion: null,
    consentTextSha256: null,
    autoRefundAckAt: null,
    consentUserId: null,
    accountDisplayName: "Ana S.",
    accountEmailMasked: "an••@gmail.com",
    ...overrides,
  };
}

function signedWebhook(body: string) {
  const dataId = "abc123";
  const ts = "1700000000";
  const requestId = "req-1";
  const manifest = mercadoPagoManifest({ dataId, requestId, ts });
  const signature = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
  return {
    body,
    headers: new Headers({ "x-signature": `ts=${ts},v1=${signature}`, "x-request-id": requestId }),
    url: `https://app.example.com/api/webhooks/payments/mercadopago?data.id=${dataId}&type=mp-connect`,
    now: new Date(Number(ts) * 1000),
  };
}

describe("invalidação do catálogo na conexão Mercado Pago", () => {
  afterEach(() => {
    delete process.env.NEXT_RUNTIME;
    revalidateTag.mockClear();
  });

  it("desautorizar invalida o catálogo do negócio", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const store = createMemoryMpStore([connection()]);
    const signed = signedWebhook(JSON.stringify({ action: "application.deauthorized", type: "mp-connect", user_id: "4242" }));
    await handleMpConnectWebhook({
      ...signed,
      env,
      store,
      events: createMemoryWebhookEvents((mpUserId) => store.markDeauthorized(mpUserId)),
      fetchImpl: async () => new Response(null, { status: 401 }),
    });
    expect(revalidateTag).toHaveBeenCalledWith("public-catalog:studio", { expire: 0 });
  });

  it("token ilegível, invalid_grant e refresh gravado invalidam; token ainda fresco não", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const fresh = await refreshMercadoPagoConnection(businessId, {
      store: createMemoryMpStore([connection()]),
      env,
      now,
      fetchImpl: async () => Response.json({}),
    });
    expect(fresh.outcome).toBe("fresh");
    expect(revalidateTag).not.toHaveBeenCalled();

    const unreadable = await refreshMercadoPagoConnection(businessId, {
      store: createMemoryMpStore([connection({
        refreshTokenEnc: "nao-e-token",
        expiresAt: new Date("2026-10-08T18:00:00.000Z"),
      })]),
      env,
      now,
      fetchImpl: async () => Response.json({}),
    });
    expect(unreadable.outcome).toBe("needs_reconnect");
    expect(revalidateTag).toHaveBeenCalledWith("public-catalog:studio", { expire: 0 });

    revalidateTag.mockClear();
    const denied = await refreshMercadoPagoConnection(businessId, {
      store: createMemoryMpStore([connection({ expiresAt: new Date("2026-10-08T18:00:00.000Z") })]),
      env,
      now,
      fetchImpl: async () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    });
    expect(denied.outcome).toBe("needs_reconnect");
    expect(revalidateTag).toHaveBeenCalledWith("public-catalog:studio", { expire: 0 });

    revalidateTag.mockClear();
    const refreshed = await refreshMercadoPagoConnection(businessId, {
      store: createMemoryMpStore([connection({
        expiresAt: new Date("2026-10-08T18:00:00.000Z"),
        accountDisplayName: "Ana S.",
        accountEmailMasked: "an••@gmail.com",
      })]),
      env,
      now,
      fetchImpl: async () => Response.json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 15552000,
        user_id: 4242,
        public_key: "public-test",
        live_mode: false,
      }),
    });
    expect(refreshed.outcome).toBe("refreshed");
    expect(revalidateTag).toHaveBeenCalledWith("public-catalog:studio", { expire: 0 });
  });
});
