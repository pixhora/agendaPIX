import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertMpConnectedForDeposit, getServiceBlockedReason } from "../../lib/mercadopago-oauth/bookability";
import { mercadoPagoManifest, handleMpConnectWebhook } from "../../lib/mercadopago-oauth/connect-webhook";
import { encryptMpToken } from "../../lib/mercadopago-oauth/crypto";
import { disconnectMercadoPago, findBusinessIdByMpUserId, getMercadoPagoOwnerStatus, getSellerAccessToken, getSellerAccessTokenForSettlement, isMpConnected } from "../../lib/mercadopago-oauth/credentials";
import { assertPlaintextAbsent, beginMercadoPagoConnect, completeMercadoPagoConnect } from "../../lib/mercadopago-oauth/flow";
import { createMemoryMpStore } from "../../lib/mercadopago-oauth/memory-store";
import { sanitizeMpReturnTo } from "../../lib/mercadopago-oauth/return-to";
import { disconnectedTokensReadyToPurge, purgeDisconnectedMercadoPagoTokens, refreshMercadoPagoConnection } from "../../lib/mercadopago-oauth/refresh";
import { openMpOAuthState } from "../../lib/mercadopago-oauth/state";
import type { MpConnection } from "../../lib/mercadopago-oauth/types";

const businessId = "11111111-1111-4111-8111-111111111111";
const otherBusinessId = "22222222-2222-4222-8222-222222222222";
const key = "ab".repeat(32);
const secret = "c".repeat(40);
const webhookSecret = "d".repeat(40);
const now = new Date("2026-10-08T12:00:00.000Z");
const env = {
  MP_CLIENT_ID: "mp-client",
  MP_CLIENT_SECRET: "mp-client-secret",
  MP_OAUTH_REDIRECT_URI: "https://app.example.com/api/integrations/mercadopago/callback",
  MP_TOKEN_ENCRYPTION_KEY: key,
  BETTER_AUTH_URL: "https://app.example.com",
  BETTER_AUTH_SECRET: secret,
  MERCADOPAGO_WEBHOOK_SECRET: webhookSecret,
};

function tokenResponse(access = "seller-access", refresh = "seller-refresh") {
  return Response.json({
    access_token: access,
    refresh_token: refresh,
    expires_in: 15552000,
    user_id: 4242,
    public_key: "public-test",
    live_mode: false,
  });
}

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
    ...overrides,
  };
}

describe("OAuth Mercado Pago por negócio", () => {
  it("monta a autorização com PKCE e sem scope", () => {
    const started = beginMercadoPagoConnect({ businessId, returnTo: "/onboarding/pagamento", now, env });
    const url = new URL(started.authorizationUrl);
    expect(url.origin).toBe("https://auth.mercadopago.com.br");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("platform_id")).toBe("mp");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe(env.MP_OAUTH_REDIRECT_URI);
    expect(assertPlaintextAbsent(started.cookie, ["mp-client-secret", "seller-access"])).toBe(true);
    expect(sanitizeMpReturnTo("/dashboard/settings?tab=pagamento")).toBe("/dashboard/settings?tab=pagamento");
    expect(sanitizeMpReturnTo("/onboarding/concluir")).toBe("/onboarding/concluir");
    for (const hostile of ["https://evil.example", "//evil.example", "/\\evil", "/dashboard@evil", "/dashboarding", "javascript:alert(1)"]) {
      expect(sanitizeMpReturnTo(hostile)).toBe("/dashboard");
    }
  });

  it("rejeita state inválido ou vencido e troca o code só uma vez", async () => {
    const store = createMemoryMpStore();
    const started = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard/settings", now, env });
    const state = new URL(started.authorizationUrl).searchParams.get("state");
    const expired = openMpOAuthState(started.cookie, secret, now.getTime() + 11 * 60 * 1000);
    expect(expired.ok).toBe(false);
    const mismatch = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=abc&state=${state}`,
      cookie: undefined,
      ownerId: "owner",
      now,
      env,
      store,
      ownsBusiness: async () => true,
    });
    expect(mismatch.path).toContain("reason=state_mismatch");
    const denied = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?error=access_denied&state=${state}`,
      cookie: started.cookie,
      ownerId: "owner",
      now,
      env,
      store,
      ownsBusiness: async () => true,
    });
    expect(denied.path).toContain("reason=access_denied");
    let calls = 0;
    const finished = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=abc&state=${state}`,
      cookie: started.cookie,
      ownerId: "owner",
      now,
      env,
      store,
      ownsBusiness: async () => true,
      fetchImpl: async (_url, init) => {
        calls += 1;
        const body = JSON.parse(String(init?.body));
        expect(body.grant_type).toBe("authorization_code");
        expect(body.code_verifier).toHaveLength(43);
        expect(body).not.toHaveProperty("scope");
        return tokenResponse();
      },
    });
    expect(finished.path).toContain("mp=connected");
    expect(calls).toBe(1);
    const saved = await store.findByBusinessId(businessId);
    expect(saved?.accessTokenEnc).not.toContain("seller-access");
    expect(await findBusinessIdByMpUserId("4242", { store })).toBe(businessId);
    expect(await isMpConnected(businessId, { store, now })).toBe(true);
  });

  it("mapeia code inválido e conta já ligada a outro negócio", async () => {
    const store = createMemoryMpStore([connection({ businessId: otherBusinessId, mpUserId: "4242" })]);
    const started = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard", now, env });
    const state = new URL(started.authorizationUrl).searchParams.get("state");
    const expiredCode = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=old&state=${state}`,
      cookie: started.cookie,
      ownerId: "owner",
      now,
      env,
      store,
      ownsBusiness: async () => true,
      fetchImpl: async () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    });
    expect(expiredCode.path).toContain("reason=expired_code");
    const taken = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=new&state=${state}`,
      cookie: started.cookie,
      ownerId: "owner",
      now,
      env,
      store,
      ownsBusiness: async () => true,
      fetchImpl: async () => tokenResponse(),
    });
    expect(taken.path).toContain("reason=already_linked_elsewhere");
  });

  it("rotaciona o refresh uma vez sob concorrência e marca needs_reconnect no invalid_grant", async () => {
    const store = createMemoryMpStore([connection({ expiresAt: new Date("2026-10-08T18:00:00.000Z") })]);
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return tokenResponse("rotated-access", "rotated-refresh");
    };
    const [first, second] = await Promise.all([
      refreshMercadoPagoConnection(businessId, { store, env, now, fetchImpl }),
      refreshMercadoPagoConnection(businessId, { store, env, now, fetchImpl }),
    ]);
    expect(calls).toBe(1);
    expect([first.outcome, second.outcome].sort()).toEqual(["fresh", "refreshed"]);
    const seller = await getSellerAccessToken(businessId, { store, env, now });
    expect(seller).toEqual({ accessToken: "rotated-access", mpUserId: "4242" });
    const broken = createMemoryMpStore([connection({ expiresAt: new Date("2026-10-08T18:00:00.000Z") })]);
    const failed = await refreshMercadoPagoConnection(businessId, {
      store: broken,
      env,
      now,
      fetchImpl: async () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    });
    expect(failed.outcome).toBe("needs_reconnect");
    expect((await broken.findByBusinessId(businessId))?.accessTokenEnc).toBeNull();
    expect(await getSellerAccessTokenForSettlement(businessId, { store: broken, env })).toBeNull();
  });

  it("não apaga tokens quando a rede falha na renovação", async () => {
    const store = createMemoryMpStore([connection({ expiresAt: new Date("2026-10-08T18:00:00.000Z") })]);
    await expect(refreshMercadoPagoConnection(businessId, {
      store,
      env,
      now,
      fetchImpl: async () => { throw new Error("offline"); },
    })).rejects.toMatchObject({ status: 503, code: "mp_oauth_refresh_failed" });
    expect((await store.findByBusinessId(businessId))?.accessTokenEnc).toContain("v1.");
  });

  it("desconecta sem apagar o token de liquidação e esconde o status público", async () => {
    const store = createMemoryMpStore([connection()]);
    await disconnectMercadoPago(businessId, { store, now });
    await disconnectMercadoPago(businessId, { store, now: new Date("2026-10-09T00:00:00.000Z") });
    const row = await store.findByBusinessId(businessId);
    expect(row?.status).toBe("disconnected");
    expect(row?.disconnectedAt?.toISOString()).toBe(now.toISOString());
    expect(row?.accessTokenEnc).toContain("v1.");
    expect(await getMercadoPagoOwnerStatus(businessId, { store, now })).toEqual({
      status: "not_connected",
      connectedAt: null,
      expiresAt: null,
      liveMode: null,
      canReceiveDeposits: false,
    });
    expect(await getSellerAccessToken(businessId, { store, env, now })).toBeNull();
    expect(await isMpConnected(businessId, { store, now })).toBe(false);
    expect(await getSellerAccessTokenForSettlement(businessId, { store, env })).toEqual({ accessToken: "seller-access", mpUserId: "4242" });
    expect(await findBusinessIdByMpUserId("4242", { store })).toBeNull();
    await expect(assertMpConnectedForDeposit(businessId, { store, now })).rejects.toMatchObject({ status: 409, code: "mp_account_not_connected" });
  });

  it("apaga tokens desconectados só depois do último vencimento mais 24h", async () => {
    const store = createMemoryMpStore([connection({ status: "disconnected", disconnectedAt: now })]);
    const pendingUntil = new Date("2026-10-08T15:00:00.000Z");
    store.pendingExpiresAt.set(businessId, pendingUntil);
    expect(disconnectedTokensReadyToPurge(pendingUntil, new Date(pendingUntil.getTime() + 23 * 60 * 60 * 1000))).toBe(false);
    expect(await purgeDisconnectedMercadoPagoTokens({ store, now: new Date(pendingUntil.getTime() + 23 * 60 * 60 * 1000) })).toEqual({ purged: 0 });
    expect((await store.findByBusinessId(businessId))?.accessTokenEnc).toContain("v1.");
    expect(await purgeDisconnectedMercadoPagoTokens({ store, now: new Date(pendingUntil.getTime() + 24 * 60 * 60 * 1000) })).toEqual({ purged: 1 });
    expect((await store.findByBusinessId(businessId))?.accessTokenEnc).toBeNull();
    expect(await getSellerAccessTokenForSettlement(businessId, { store, env })).toBeNull();
    expect(disconnectedTokensReadyToPurge(null, now)).toBe(true);
  });

  it("revogação do MP marca needs_reconnect e não assume que o token ainda funciona", async () => {
    const store = createMemoryMpStore([connection({ status: "disconnected", disconnectedAt: now })]);
    const dataId = "AbC123";
    const ts = "1700000000";
    const requestId = "req-1";
    const manifest = mercadoPagoManifest({ dataId, requestId, ts });
    const signature = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
    const headers = new Headers({ "x-signature": `ts=${ts},v1=${signature}`, "x-request-id": requestId });
    const url = `https://app.example.com/api/webhooks/payments/mercadopago?data.id=${dataId}&type=mp-connect`;
    const ignored = await handleMpConnectWebhook({
      body: JSON.stringify({ action: "application.authorized", type: "mp-connect", user_id: 4242 }),
      headers,
      url,
      env,
      store,
    });
    expect(ignored).toEqual({ outcome: "ignored", reason: "authorized_without_token_exchange" });
    expect((await store.findByBusinessId(businessId))?.accessTokenEnc).toContain("v1.");
    const deauthorized = await handleMpConnectWebhook({
      body: JSON.stringify({ action: "application.deauthorized", type: "mp-connect", user_id: "4242" }),
      headers,
      url,
      env,
      store,
    });
    expect(deauthorized).toEqual({ outcome: "deauthorized" });
    const row = await store.findByBusinessId(businessId);
    expect(row?.status).toBe("needs_reconnect");
    expect(row?.accessTokenEnc).toBeNull();
    expect(await getSellerAccessTokenForSettlement(businessId, { store, env })).toBeNull();
    await expect(handleMpConnectWebhook({
      body: JSON.stringify({ action: "application.deauthorized", type: "mp-connect", user_id: "4242" }),
      headers: new Headers({ "x-signature": "ts=1,v1=00" }),
      url,
      env,
      store,
    })).rejects.toMatchObject({ status: 401, code: "invalid_signature" });
  });

  it("serviço sem sinal continua agendável por este critério", () => {
    expect(getServiceBlockedReason({ depositCents: 0 }, { mpConnected: false })).toBeNull();
    expect(getServiceBlockedReason({ depositCents: 1000 }, { mpConnected: false })).toBe("mp_account_not_connected");
    expect(getServiceBlockedReason({ depositCents: 1000 }, { mpConnected: true })).toBeNull();
  });
});
