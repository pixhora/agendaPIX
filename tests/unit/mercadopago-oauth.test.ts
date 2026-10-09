import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertMpConnectedForDeposit, getServiceBlockedReason } from "../../lib/mercadopago-oauth/bookability";
import { mercadoPagoManifest, handleMpConnectWebhook } from "../../lib/mercadopago-oauth/connect-webhook";
import { encryptMpToken } from "../../lib/mercadopago-oauth/crypto";
import { disconnectMercadoPago, findBusinessIdByMpUserId, getMercadoPagoOwnerStatus, getSellerAccessToken, getSellerAccessTokenForSettlement, isMpConnected } from "../../lib/mercadopago-oauth/credentials";
import { MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import { MP_USERS_ME_URL } from "../../lib/mercadopago-oauth/account-profile";
import { maskEmail } from "../../lib/privacy/mask-email";
import { assertPlaintextAbsent, beginMercadoPagoConnect, completeMercadoPagoConnect, submitMercadoPagoConnect } from "../../lib/mercadopago-oauth/flow";
import { GET as connectGet } from "../../app/api/businesses/[businessId]/mercadopago/connect/route";
import { createMemoryMpStore } from "../../lib/mercadopago-oauth/memory-store";
import { sanitizeMpReturnTo } from "../../lib/mercadopago-oauth/return-to";
import { disconnectedTokensReadyToPurge, purgeDisconnectedMercadoPagoTokens, refreshMercadoPagoConnection } from "../../lib/mercadopago-oauth/refresh";
import { HttpError } from "../../lib/http";
import { register } from "../../instrumentation";
import { openMpOAuthState, sealMpOAuthState, type MpOAuthCookie } from "../../lib/mercadopago-oauth/state";
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

async function pinConsent(store: ReturnType<typeof createMemoryMpStore>, authorizationUrl: string) {
  const state = new URL(authorizationUrl).searchParams.get("state");
  if (!state) throw new Error("state ausente");
  await store.saveOAuthState({
    state,
    businessId,
    returnTo: "/dashboard",
    consentVersion: MP_CONNECT_CONSENT_VERSION,
    consentTextSha256: createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex"),
    autoRefundAckAt: now,
    consentUserId: "owner",
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
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
    consentVersion: null,
    consentTextSha256: null,
    autoRefundAckAt: null,
    consentUserId: null,
    accountDisplayName: null,
    accountEmailMasked: null,
    ...overrides,
  };
}

describe("OAuth Mercado Pago por negócio", () => {
  it("monta a autorização sem PKCE por padrão e sem scope", () => {
    const started = beginMercadoPagoConnect({ businessId, returnTo: "/onboarding/pagamento", now, env });
    const url = new URL(started.authorizationUrl);
    expect(url.origin).toBe("https://auth.mercadopago.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("platform_id")).toBe("mp");
    expect(url.searchParams.get("state")?.length).toBeGreaterThanOrEqual(32);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.has("code_challenge_method")).toBe(false);
    expect(url.searchParams.has("scope")).toBe(false);
    const opened = openMpOAuthState(started.cookie, secret, now.getTime());
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.payload.pkce).toBe(false);
      expect("verifier" in opened.payload).toBe(false);
    }
    const custom = beginMercadoPagoConnect({
      businessId,
      returnTo: "/dashboard",
      now,
      env: { ...env, MP_OAUTH_AUTHORIZE_URL: "https://auth.mercadopago.com.br/authorization" },
    });
    expect(new URL(custom.authorizationUrl).origin).toBe("https://auth.mercadopago.com.br");
    expect(url.searchParams.get("redirect_uri")).toBe(env.MP_OAUTH_REDIRECT_URI);
    expect(assertPlaintextAbsent(started.cookie, ["mp-client-secret", "seller-access"])).toBe(true);
    expect(sanitizeMpReturnTo("/dashboard/settings?tab=pagamento")).toBe("/dashboard/settings?tab=pagamento");
    expect(sanitizeMpReturnTo("/onboarding/concluir")).toBe("/onboarding/concluir");
    for (const hostile of ["https://evil.example", "//evil.example", "/\\evil", "/dashboard@evil", "/dashboarding", "javascript:alert(1)"]) {
      expect(sanitizeMpReturnTo(hostile)).toBe("/dashboard");
    }
  });

  it("com PKCE ligado manda challenge e code_verifier, e o callback segue o cookie", async () => {
    const onEnv = { ...env, MP_OAUTH_PKCE: " on " };
    const offEnv = { ...env, MP_OAUTH_PKCE: "off" };
    const on = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard", now, env: onEnv });
    const onUrl = new URL(on.authorizationUrl);
    expect(onUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(onUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(onUrl.searchParams.get("state")?.length).toBeGreaterThanOrEqual(32);
    const onCookie = openMpOAuthState(on.cookie, secret, now.getTime());
    expect(onCookie.ok && onCookie.payload.pkce).toBe(true);
    const verifier = onCookie.ok && onCookie.payload.pkce ? onCookie.payload.verifier : "";
    expect(verifier).toHaveLength(43);

    const store = createMemoryMpStore();
    await pinConsent(store, on.authorizationUrl);
    let onBody: Record<string, unknown> | null = null;
    await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=abc&state=${onUrl.searchParams.get("state")}`,
      cookie: on.cookie,
      ownerId: "owner",
      now,
      env: offEnv,
      store,
      ownsBusiness: async () => true,
      fetchImpl: async (url, init) => {
        if (url === MP_USERS_ME_URL) return Response.json({ nickname: "ana" });
        onBody = JSON.parse(String(init?.body));
        return tokenResponse();
      },
    });
    expect(onBody).toMatchObject({ grant_type: "authorization_code", code_verifier: verifier });

    const off = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard", now, env: offEnv });
    const offUrl = new URL(off.authorizationUrl);
    expect(offUrl.searchParams.has("code_challenge")).toBe(false);
    expect(offUrl.searchParams.has("code_challenge_method")).toBe(false);
    const storeOff = createMemoryMpStore();
    await pinConsent(storeOff, off.authorizationUrl);
    let offBody: Record<string, unknown> | null = null;
    await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=abc&state=${offUrl.searchParams.get("state")}`,
      cookie: off.cookie,
      ownerId: "owner",
      now,
      env: onEnv,
      store: storeOff,
      ownsBusiness: async () => true,
      fetchImpl: async (url, init) => {
        if (url === MP_USERS_ME_URL) return Response.json({ nickname: "ana" });
        offBody = JSON.parse(String(init?.body));
        return tokenResponse();
      },
    });
    expect(offBody).not.toHaveProperty("code_verifier");
  });

  it("aceita state sem verifier no modo off e rejeita no modo on", () => {
    const exp = now.getTime() + 60_000;
    const without = sealMpOAuthState({
      state: "a".repeat(43),
      pkce: false,
      businessId,
      returnTo: "/dashboard",
      exp,
    }, secret);
    const opened = openMpOAuthState(without, secret, now.getTime());
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.payload.pkce).toBe(false);

    const missing = sealMpOAuthState({
      state: "b".repeat(43),
      pkce: true,
      businessId,
      returnTo: "/dashboard",
      exp,
    } as MpOAuthCookie, secret);
    expect(openMpOAuthState(missing, secret, now.getTime()).ok).toBe(false);

    const short = sealMpOAuthState({
      state: "c".repeat(43),
      pkce: true,
      verifier: "x".repeat(42),
      businessId,
      returnTo: "/dashboard",
      exp,
    } as MpOAuthCookie, secret);
    expect(openMpOAuthState(short, secret, now.getTime()).ok).toBe(false);

    const long = sealMpOAuthState({
      state: "d".repeat(43),
      pkce: true,
      verifier: "y".repeat(129),
      businessId,
      returnTo: "/dashboard",
      exp,
    } as MpOAuthCookie, secret);
    expect(openMpOAuthState(long, secret, now.getTime()).ok).toBe(false);
  });

  it("rejeita MP_OAUTH_PKCE diferente de on ou off no uso e no boot", async () => {
    for (const value of ["yes", "ON", ""]) {
      expect(() => beginMercadoPagoConnect({
        businessId,
        returnTo: "/dashboard",
        now,
        env: { ...env, MP_OAUTH_PKCE: value },
      })).toThrow(expect.objectContaining({ status: 503, code: "mp_oauth_pkce_invalid", message: "MP_OAUTH_PKCE deve ser on ou off." }));
    }
    const previous = process.env.MP_OAUTH_PKCE;
    process.env.MP_OAUTH_PKCE = "talvez";
    try {
      await expect(register()).rejects.toBeInstanceOf(HttpError);
      await expect(register()).rejects.toMatchObject({ status: 503, code: "mp_oauth_pkce_invalid", message: "MP_OAUTH_PKCE deve ser on ou off." });
    } finally {
      if (previous === undefined) delete process.env.MP_OAUTH_PKCE;
      else process.env.MP_OAUTH_PKCE = previous;
    }
  });

  it("rejeita state inválido ou vencido e troca o code só uma vez", async () => {
    const store = createMemoryMpStore();
    const started = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard/settings", now, env });
    const state = new URL(started.authorizationUrl).searchParams.get("state");
    await pinConsent(store, started.authorizationUrl);
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
      clientIp: "203.0.113.10",
      fetchImpl: async (url, init) => {
        if (url === MP_USERS_ME_URL) {
          return Response.json({
            id: 99887766,
            first_name: "Ana",
            last_name: "Silva",
            nickname: "ana",
            email: "ana.souza@gmail.com",
            identification: { type: "CPF", number: "12345678900" },
          });
        }
        calls += 1;
        const body = JSON.parse(String(init?.body));
        expect(body.grant_type).toBe("authorization_code");
        expect(body).not.toHaveProperty("code_verifier");
        expect(body).not.toHaveProperty("scope");
        return tokenResponse();
      },
    });
    expect(finished.path).toContain("mp=connected");
    const saved = await store.findByBusinessId(businessId);
    expect(saved?.consentVersion).toBe(MP_CONNECT_CONSENT_VERSION);
    expect(saved?.consentTextSha256).toBe(createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex"));
    expect(saved?.consentUserId).toBe("owner");
    expect(saved?.accountDisplayName).toBe("Ana S.");
    expect(saved?.accountEmailMasked).toBe(maskEmail("ana.souza@gmail.com"));
    expect(saved?.accountEmailMasked).toBe("an\u2022\u2022@gmail.com");
    expect(JSON.stringify(saved)).not.toContain("ana.souza@gmail.com");
    expect(JSON.stringify(saved)).not.toContain("12345678900");
    expect(JSON.stringify(saved)).not.toContain("seller-access");
    expect(JSON.stringify(store.consentEvents)).not.toContain("ana.souza@gmail.com");
    expect(JSON.stringify(store.consentEvents)).not.toContain("seller-access");
    expect(JSON.stringify(saved)).not.toContain("203.0.113.10");
    expect(store.consentEvents).toEqual([{ businessId, kind: "consent_recorded", ip: "203.0.113.10", createdAt: now }]);
    expect(await store.findOAuthState(state ?? "")).toBeNull();
    expect(calls).toBe(1);
    expect(saved?.accessTokenEnc).not.toContain("seller-access");
    expect(await findBusinessIdByMpUserId("4242", { store })).toBe(businessId);
    expect(await isMpConnected(businessId, { store, now })).toBe(true);
  });

  it("mapeia code inválido e conta já ligada a outro negócio", async () => {
    const store = createMemoryMpStore([connection({ businessId: otherBusinessId, mpUserId: "4242" })]);
    const started = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard", now, env });
    const state = new URL(started.authorizationUrl).searchParams.get("state");
    await pinConsent(store, started.authorizationUrl);
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
    const fetchImpl = async (url: string) => {
      if (url === MP_USERS_ME_URL) return Response.json({});
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
      consentVersion: null,
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: null,
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
    const signatureNow = new Date(Number(ts) * 1000);
    const ignored = await handleMpConnectWebhook({
      body: JSON.stringify({ action: "application.authorized", type: "mp-connect", user_id: 4242 }),
      headers,
      url,
      env,
      store,
      now: signatureNow,
    });
    expect(ignored).toEqual({ outcome: "ignored", reason: "authorized_without_token_exchange" });
    expect((await store.findByBusinessId(businessId))?.accessTokenEnc).toContain("v1.");
    const deauthorized = await handleMpConnectWebhook({
      body: JSON.stringify({ action: "application.deauthorized", type: "mp-connect", user_id: "4242" }),
      headers,
      url,
      env,
      store,
      now: signatureNow,
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
      now: signatureNow,
    })).rejects.toMatchObject({ status: 401, code: "invalid_signature" });
  });

  it("recusa mp-connect com ts fora de ±5 minutos, como o webhook de pagamento", async () => {
    const store = createMemoryMpStore([connection()]);
    const dataId = "abc123";
    const requestId = "req-stale";
    const receivedAt = new Date("2026-10-08T12:00:00.000Z");
    const ts = String(Math.floor(receivedAt.getTime() / 1000) - 301);
    const manifest = mercadoPagoManifest({ dataId, requestId, ts });
    const signature = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
    await expect(handleMpConnectWebhook({
      body: JSON.stringify({ action: "application.authorized", type: "mp-connect", user_id: 4242 }),
      headers: new Headers({ "x-signature": `ts=${ts},v1=${signature}`, "x-request-id": requestId }),
      url: `https://app.example.com/api/webhooks/payments/mercadopago?data.id=${dataId}&type=mp-connect`,
      env,
      store,
      now: receivedAt,
    })).rejects.toMatchObject({ status: 401, code: "invalid_signature" });
    expect((await store.findByBusinessId(businessId))?.status).toBe("connected");
  });

  it("só inicia o OAuth por POST com consentimento da versão atual", async () => {
    expect((await connectGet()).status).toBe(405);
    expect((await connectGet()).headers.get("allow")).toBe("POST");
    const store = createMemoryMpStore();
    const headers = { origin: "https://app.example.com", "content-type": "application/x-www-form-urlencoded" };
    const denied = await submitMercadoPagoConnect({
      request: new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
        method: "POST",
        headers,
        body: new URLSearchParams({ returnTo: "/onboarding/pagamento", autoRefundAck: "on", consentVersion: "antiga" }),
      }),
      businessId,
      ownerId: "owner",
      now,
      env,
      store,
    });
    expect(denied).toMatchObject({ kind: "redirect", cookie: null });
    if (denied.kind === "redirect") expect(new URL(denied.location).searchParams.get("reason")).toBe("auto_refund_ack_required");
    const jsonDenied = await submitMercadoPagoConnect({
      request: new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
        method: "POST",
        headers: { ...headers, accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ returnTo: "/dashboard", autoRefundAck: false, consentVersion: MP_CONNECT_CONSENT_VERSION }),
      }),
      businessId,
      ownerId: "owner",
      now,
      env,
      store,
    });
    expect(jsonDenied).toEqual({ kind: "json", status: 400, body: { error: { code: "auto_refund_ack_required" } } });
    const foreign = await submitMercadoPagoConnect({
      request: new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
        method: "POST",
        headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ autoRefundAck: "1", consentVersion: MP_CONNECT_CONSENT_VERSION }),
      }),
      businessId,
      ownerId: "owner",
      now,
      env,
      store,
    });
    expect(foreign).toEqual({ kind: "json", status: 403, body: { error: { code: "forbidden_origin" } } });
    const referer = await submitMercadoPagoConnect({
      request: new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
        method: "POST",
        headers: { referer: "https://app.example.com/dashboard/settings", "content-type": "application/json" },
        body: JSON.stringify({ returnTo: "https://evil.example", autoRefundAck: true, consentVersion: MP_CONNECT_CONSENT_VERSION }),
      }),
      businessId,
      ownerId: "owner",
      now,
      env,
      store,
    });
    expect(referer.kind).toBe("redirect");
    if (referer.kind !== "redirect" || !referer.cookie) throw new Error("redirect sem cookie");
    expect(referer.location).toContain("https://auth.mercadopago.com/authorization");
    expect(new URL(referer.location).searchParams.has("scope")).toBe(false);
    const state = new URL(referer.location).searchParams.get("state");
    const pending = await store.findOAuthState(state ?? "");
    expect(MP_CONNECT_CONSENT_TEXT).toBe("Entendi e autorizo: quando um Pix chega depois do prazo, o AgendaPix pede a devolução do valor ao Mercado Pago, sem você precisar fazer nada. Na política padrão, todo Pix atrasado é devolvido. Se você escolher remarcar quando o horário estiver livre, a reserva é confirmada se o horário ainda estiver disponível e o valor é devolvido se não estiver. Se essa devolução falhar, eu devolvo manualmente em até 7 dias corridos, contados do aviso.");
    expect(pending?.consentVersion).toBe(MP_CONNECT_CONSENT_VERSION);
    expect(pending?.consentTextSha256).toBe(createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex"));
    expect(pending?.consentUserId).toBe("owner");
    expect(pending?.returnTo).toBe("/dashboard");
    const storedHash = "ab".repeat(32);
    const again = createMemoryMpStore([connection({
      consentVersion: MP_CONNECT_CONSENT_VERSION,
      consentTextSha256: storedHash,
      autoRefundAckAt: now,
      consentUserId: "owner-original",
    })]);
    const reused = await submitMercadoPagoConnect({
      request: new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
        method: "POST",
        headers: { origin: "https://app.example.com", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ returnTo: "/dashboard/settings" }),
      }),
      businessId,
      ownerId: "owner",
      now,
      env,
      store: again,
    });
    expect(reused.kind).toBe("redirect");
    if (reused.kind !== "redirect") throw new Error("reconexão sem redirect");
    const reusedState = await again.findOAuthState(new URL(reused.location).searchParams.get("state") ?? "");
    expect(reusedState?.consentUserId).toBe("owner-original");
    expect(reusedState?.consentTextSha256).toBe(storedHash);
    expect(reusedState?.autoRefundAckAt).toEqual(now);
  });

  it("serviço sem sinal continua agendável por este critério", () => {
    expect(getServiceBlockedReason({ depositCents: 0 }, { mpConnected: false })).toBeNull();
    expect(getServiceBlockedReason({ depositCents: 1000 }, { mpConnected: false })).toBe("mp_account_not_connected");
    expect(getServiceBlockedReason({ depositCents: 1000 }, { mpConnected: true })).toBeNull();
  });

  it("mostra o nome da conta e o e-mail mascarado, e esconde os dois quando desconectado", async () => {
    expect(maskEmail("ana.souza@gmail.com")).toBe("an\u2022\u2022@gmail.com");
    expect(maskEmail("ab@x.com")).toBe("a\u2022\u2022@x.com");
    const store = createMemoryMpStore();
    const started = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard", now, env });
    await pinConsent(store, started.authorizationUrl);
    const state = new URL(started.authorizationUrl).searchParams.get("state");
    const finished = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=abc&state=${state}`,
      cookie: started.cookie,
      ownerId: "owner",
      now,
      env,
      store,
      ownsBusiness: async () => true,
      fetchImpl: async (url) => {
        if (url === MP_USERS_ME_URL) return Response.json({ nickname: "barbearia", last_name: "Silva", email: "ab@x.com" });
        return tokenResponse();
      },
    });
    expect(finished.path).toContain("mp=connected");
    const saved = await store.findByBusinessId(businessId);
    expect(saved?.status).toBe("connected");
    expect(saved?.accountDisplayName).toBe("barbearia");
    expect(saved?.accountEmailMasked).toBe("a\u2022\u2022@x.com");
    expect(JSON.stringify(saved)).not.toContain("ab@x.com");
    const visible = await getMercadoPagoOwnerStatus(businessId, { store, now });
    expect(visible).toMatchObject({
      status: "connected",
      accountName: "barbearia",
      accountEmailMasked: "a\u2022\u2022@x.com",
      accountIdLast4: "4242",
    });
    expect(JSON.stringify(visible)).not.toContain("ab@x.com");
    const shown = createMemoryMpStore([connection({
      mpUserId: "99887766",
      accountDisplayName: "Ana S.",
      accountEmailMasked: "an\u2022\u2022@gmail.com",
    })]);
    const open = await getMercadoPagoOwnerStatus(businessId, { store: shown, now });
    expect(open).toMatchObject({ status: "connected", accountName: "Ana S.", accountEmailMasked: "an\u2022\u2022@gmail.com", accountIdLast4: "7766" });
    expect(JSON.stringify(open)).not.toContain("99887766");
    expect(JSON.stringify(open)).not.toContain("ana.souza@gmail.com");
    const named = createMemoryMpStore([connection({
      mpUserId: "99887766",
      accountDisplayName: "Ana S.",
      accountEmailMasked: "an\u2022\u2022@gmail.com",
      status: "disconnected",
      disconnectedAt: now,
    })]);
    const hidden = await getMercadoPagoOwnerStatus(businessId, { store: named, now });
    expect(hidden).toMatchObject({ status: "not_connected", accountName: null, accountEmailMasked: null, accountIdLast4: null });
    expect(JSON.stringify(hidden)).not.toContain("99887766");
    expect(JSON.stringify(hidden)).not.toContain("ana.souza@gmail.com");
  });

  it("mantém a conexão quando /users/me estoura o tempo ou responde 500", async () => {
    const fullEmail = "ana.souza@gmail.com";
    const timeoutStore = createMemoryMpStore();
    const timeoutStart = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard", now, env });
    await pinConsent(timeoutStore, timeoutStart.authorizationUrl);
    const timeoutState = new URL(timeoutStart.authorizationUrl).searchParams.get("state");
    const timedOut = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=abc&state=${timeoutState}`,
      cookie: timeoutStart.cookie,
      ownerId: "owner",
      now,
      env,
      store: timeoutStore,
      ownsBusiness: async () => true,
      profileTimeoutMs: 20,
      fetchImpl: async (url, init) => {
        if (url === MP_USERS_ME_URL) {
          await new Promise((_resolve, reject) => {
            const abort = () => reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
            if (init?.signal?.aborted) abort();
            else init?.signal?.addEventListener("abort", abort, { once: true });
          });
        }
        return tokenResponse();
      },
    });
    expect(timedOut.path).toContain("mp=connected");
    const timedOutRow = await timeoutStore.findByBusinessId(businessId);
    expect(timedOutRow?.status).toBe("connected");
    expect(timedOutRow?.accessTokenEnc).toContain("v1.");
    expect(timedOutRow?.accountDisplayName).toBeNull();
    expect(timedOutRow?.accountEmailMasked).toBeNull();
    expect(timeoutStore.consentEvents).toContainEqual(expect.objectContaining({ kind: "account_profile_failed", detail: "timeout" }));
    expect(JSON.stringify(timeoutStore.consentEvents)).not.toContain("seller-access");

    const failedStore = createMemoryMpStore();
    const failedStart = beginMercadoPagoConnect({ businessId, returnTo: "/dashboard", now, env });
    await pinConsent(failedStore, failedStart.authorizationUrl);
    const failedState = new URL(failedStart.authorizationUrl).searchParams.get("state");
    const failed = await completeMercadoPagoConnect({
      requestUrl: `https://app.example.com/callback?code=abc&state=${failedState}`,
      cookie: failedStart.cookie,
      ownerId: "owner",
      now,
      env,
      store: failedStore,
      ownsBusiness: async () => true,
      fetchImpl: async (url) => {
        if (url === MP_USERS_ME_URL) return Response.json({ email: fullEmail, first_name: "Ana", last_name: "Silva" }, { status: 500 });
        return tokenResponse();
      },
    });
    expect(failed.path).toContain("mp=connected");
    const failedRow = await failedStore.findByBusinessId(businessId);
    expect(failedRow?.status).toBe("connected");
    expect(failedRow?.accountDisplayName).toBeNull();
    expect(failedRow?.accountEmailMasked).toBeNull();
    expect(failedStore.consentEvents).toContainEqual(expect.objectContaining({ kind: "account_profile_failed", detail: "http_500" }));
    const dumped = JSON.stringify({ row: failedRow, events: failedStore.consentEvents });
    expect(dumped).not.toContain(fullEmail);
    expect(dumped).not.toContain("seller-access");
  });

  it("busca de novo o perfil no refresh enquanto nome e e-mail mascarado estão vazios", async () => {
    const fullEmail = "ana.souza@gmail.com";
    const store = createMemoryMpStore([connection({ expiresAt: new Date("2026-10-08T18:00:00.000Z") })]);
    let profileCalls = 0;
    const refreshed = await refreshMercadoPagoConnection(businessId, {
      store,
      env,
      now,
      fetchImpl: async (url) => {
        if (url === MP_USERS_ME_URL) {
          profileCalls += 1;
          return Response.json({ first_name: "Ana", last_name: "Silva", email: fullEmail });
        }
        return tokenResponse("rotated-access", "rotated-refresh");
      },
    });
    expect(refreshed.outcome).toBe("refreshed");
    expect(profileCalls).toBe(1);
    const row = await store.findByBusinessId(businessId);
    expect(row?.accountDisplayName).toBe("Ana S.");
    expect(row?.accountEmailMasked).toBe("an\u2022\u2022@gmail.com");
    expect(JSON.stringify(row)).not.toContain(fullEmail);
    expect(JSON.stringify(store.consentEvents)).not.toContain(fullEmail);
    profileCalls = 0;
    await refreshMercadoPagoConnection(businessId, {
      store,
      env,
      now: new Date("2027-03-01T00:00:00.000Z"),
      fetchImpl: async (url) => {
        if (url === MP_USERS_ME_URL) profileCalls += 1;
        return tokenResponse("again-access", "again-refresh");
      },
    });
    expect(profileCalls).toBe(0);
    expect((await store.findByBusinessId(businessId))?.accountDisplayName).toBe("Ana S.");
  });
});
