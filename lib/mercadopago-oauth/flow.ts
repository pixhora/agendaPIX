import { createHash } from "node:crypto";
import { isAutoRefundAck, MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "../mercadopago/consent";
import { invalidatePublicCatalogForBusiness } from "../bookings/public-cache";
import { normalizeClientAddress } from "../bookings/rate-limit";
import { findOwnedBusiness } from "../tenancy";
import { authEnvSchema } from "../env";
import { HttpError, readBody } from "../http";
import { syncAccountProfile } from "./account-profile";
import { mpOAuthConfig, type MpOAuthConfig } from "./config";
import { encryptMpToken } from "./crypto";
import { getMercadoPagoOwnerStatus, type MpOwnerStatus } from "./credentials";
import { createDrizzleMpStore } from "./repository";
import { codeChallengeS256, createCodeVerifier, createOAuthState } from "./pkce";
import { MP_OAUTH_COOKIE_MAX_AGE_SECONDS, openMpOAuthState, sealMpOAuthState } from "./state";
import { requestMpToken, type MpFetch } from "./token-client";
import type { MpConnectionStore } from "./types";
import { mpResultPath, sanitizeMpReturnTo, type MpCallbackReason } from "./return-to";
import { safeEqualString } from "./timing";

export type MpConnectStart = { authorizationUrl: string; cookie: string; returnTo: string };

export function beginMercadoPagoConnect(input: { businessId: string; returnTo: unknown; now?: Date; env?: Readonly<Record<string, string | undefined>> }): MpConnectStart {
  const config = mpOAuthConfig(input.env);
  const now = input.now ?? new Date();
  const returnTo = sanitizeMpReturnTo(input.returnTo);
  const state = createOAuthState();
  const verifier = config.pkce ? createCodeVerifier() : undefined;
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);
  if (verifier) {
    url.searchParams.set("code_challenge", codeChallengeS256(verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  // Não enviamos `scope`: a doc lista read, write e offline_access, e o padrão da aplicação já inclui write.
  // Pedir um subconjunto poderia restringir a escrita usada no estorno.
  const exp = now.getTime() + MP_OAUTH_COOKIE_MAX_AGE_SECONDS * 1000;
  const cookie = sealMpOAuthState(verifier
    ? { state, pkce: true, verifier, businessId: input.businessId, returnTo, exp }
    : { state, pkce: false, businessId: input.businessId, returnTo, exp }, config.authSecret);
  return { authorizationUrl: url.toString(), cookie, returnTo };
}

export type MpConnectFinish = { path: string };

async function defaultOwns(businessId: string, ownerId: string) {
  return Boolean(await findOwnedBusiness(businessId, ownerId));
}

export async function completeMercadoPagoConnect(input: {
  requestUrl: string;
  cookie: string | undefined;
  ownerId: string | null;
  now?: Date;
  env?: Readonly<Record<string, string | undefined>>;
  fetchImpl?: MpFetch;
  store?: MpConnectionStore;
  ownsBusiness?: (businessId: string, ownerId: string) => Promise<boolean>;
  clientIp?: string | null;
  profileTimeoutMs?: number;
}): Promise<MpConnectFinish> {
  const config = mpOAuthConfig(input.env);
  const now = input.now ?? new Date();
  const request = new URL(input.requestUrl);
  const stateParam = request.searchParams.get("state");
  const errorParam = request.searchParams.get("error");
  const code = request.searchParams.get("code");
  const opened = input.cookie ? openMpOAuthState(input.cookie, config.authSecret, now.getTime()) : { ok: false as const, reason: "state_mismatch" as const };
  if (!opened.ok) return { path: mpResultPath("/dashboard", { mp: "error", reason: "state_mismatch" }) };
  const returnTo = opened.payload.returnTo;
  if (!stateParam || !safeEqualString(opened.payload.state, stateParam)) {
    return { path: mpResultPath(returnTo, { mp: "error", reason: "state_mismatch" }) };
  }
  if (errorParam === "access_denied") return { path: mpResultPath(returnTo, { mp: "error", reason: "access_denied" }) };
  if (errorParam || !code) return { path: mpResultPath(returnTo, { mp: "error", reason: "exchange_failed" }) };
  const owns = input.ownsBusiness ?? defaultOwns;
  if (!input.ownerId || !(await owns(opened.payload.businessId, input.ownerId))) {
    return { path: mpResultPath(returnTo, { mp: "error", reason: "exchange_failed" }) };
  }
  const store = input.store ?? createDrizzleMpStore();
  const pending = await store.findOAuthState(opened.payload.state);
  if (!pending || pending.businessId !== opened.payload.businessId || pending.expiresAt.getTime() <= now.getTime()) {
    return { path: mpResultPath(returnTo, { mp: "error", reason: "state_mismatch" }) };
  }
  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  };
  if (opened.payload.pkce) tokenBody.code_verifier = opened.payload.verifier;
  const exchanged = await requestMpToken(tokenBody, input.fetchImpl);
  if (!exchanged.ok) {
    const reason: MpCallbackReason = exchanged.reason === "expired_code" ? "expired_code" : "exchange_failed";
    return { path: mpResultPath(returnTo, { mp: "error", reason }) };
  }
  const existing = await store.findByBusinessId(opened.payload.businessId);
  const saved = await store.saveConnected({
    businessId: opened.payload.businessId,
    mpUserId: exchanged.tokens.mpUserId,
    accessTokenEnc: encryptMpToken(exchanged.tokens.accessToken, opened.payload.businessId, "access", config.encryptionKey),
    refreshTokenEnc: encryptMpToken(exchanged.tokens.refreshToken, opened.payload.businessId, "refresh", config.encryptionKey),
    publicKey: exchanged.tokens.publicKey,
    scope: exchanged.tokens.scope,
    liveMode: exchanged.tokens.liveMode,
    expiresAt: new Date(now.getTime() + exchanged.tokens.expiresIn * 1000),
    connectedAt: existing?.connectedAt ?? now,
    refreshedAt: null,
    status: "connected",
    lastError: null,
    disconnectedAt: null,
    consentVersion: pending.consentVersion,
    consentTextSha256: pending.consentTextSha256,
    autoRefundAckAt: pending.autoRefundAckAt,
    consentUserId: pending.consentUserId,
    accountDisplayName: null,
    accountEmailMasked: null,
  });
  if (saved === "already_linked_elsewhere") return { path: mpResultPath(returnTo, { mp: "error", reason: "already_linked_elsewhere" }) };
  await store.consumeOAuthState(pending.state);
  await store.recordConnectionEvent({ businessId: opened.payload.businessId, kind: "consent_recorded", ip: input.clientIp ?? null, createdAt: now });
  try {
    await syncAccountProfile({
      businessId: opened.payload.businessId,
      accessToken: exchanged.tokens.accessToken,
      store,
      fetchImpl: input.fetchImpl,
      now,
      timeoutMs: input.profileTimeoutMs,
    });
  } catch {
    // A consulta do perfil não desfaz a conexão já gravada.
  }
  await invalidatePublicCatalogForBusiness(opened.payload.businessId);
  return { path: mpResultPath(returnTo, { mp: "connected" }) };
}

export function requestClientIp(request: Request) {
  const real = normalizeClientAddress(request.headers.get("x-real-ip"));
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  return normalizeClientAddress(forwarded.split(",").at(-1)?.trim());
}

function sameOrigin(request: Request, appOrigin: string) {
  const origin = request.headers.get("origin");
  if (origin !== null) return origin === appOrigin;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try { return new URL(referer).origin === appOrigin; }
  catch { return false; }
}

function wantsJson(request: Request) {
  return (request.headers.get("accept") ?? "").toLowerCase().includes("application/json");
}

async function readConnectFields(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.toLowerCase().includes("application/json")) {
    try {
      const body = JSON.parse(await readBody(request)) as { returnTo?: unknown; autoRefundAck?: unknown; consentVersion?: unknown };
      return { returnTo: body?.returnTo, autoRefundAck: body?.autoRefundAck, consentVersion: body?.consentVersion };
    } catch {
      return { returnTo: undefined, autoRefundAck: undefined, consentVersion: undefined };
    }
  }
  const params = new URLSearchParams(await readBody(request));
  return {
    returnTo: params.get("returnTo") ?? undefined,
    autoRefundAck: params.get("autoRefundAck") ?? undefined,
    consentVersion: params.get("consentVersion") ?? undefined,
  };
}

export type MpConnectSubmit =
  | { kind: "redirect"; location: string; cookie: string | null }
  | { kind: "json"; status: 400 | 403; body: { error: { code: "auto_refund_ack_required" | "forbidden_origin" } } };

/** POST do connect. 303 para o MP ou de volta ao painel. JSON com Accept application/json pode receber 400. */
export async function submitMercadoPagoConnect(input: {
  request: Request;
  businessId: string;
  ownerId: string;
  now?: Date;
  env?: Readonly<Record<string, string | undefined>>;
  store?: MpConnectionStore;
}): Promise<MpConnectSubmit> {
  const config = mpOAuthConfig(input.env);
  const now = input.now ?? new Date();
  if (!sameOrigin(input.request, config.origin)) {
    return { kind: "json", status: 403, body: { error: { code: "forbidden_origin" } } };
  }
  const fields = await readConnectFields(input.request);
  const returnTo = sanitizeMpReturnTo(fields.returnTo);
  const store = input.store ?? createDrizzleMpStore();
  const existing = await store.findByBusinessId(input.businessId);
  const textSha256 = createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex");
  // Reconexão reaproveita só o aceite vigente. Versão diferente não autoriza cobrança nova.
  const reused = existing?.consentVersion === MP_CONNECT_CONSENT_VERSION && existing.autoRefundAckAt && existing.consentUserId
    ? { version: existing.consentVersion, ackAt: existing.autoRefundAckAt, userId: existing.consentUserId, textSha256: existing.consentTextSha256 ?? textSha256 }
    : null;
  const acknowledged = isAutoRefundAck(fields.autoRefundAck) && fields.consentVersion === MP_CONNECT_CONSENT_VERSION;
  if (!reused && !acknowledged) {
    if (wantsJson(input.request)) return { kind: "json", status: 400, body: { error: { code: "auto_refund_ack_required" } } };
    return { kind: "redirect", location: redirectUrl(mpResultPath(returnTo, { mp: "error", reason: "auto_refund_ack_required" }), config).toString(), cookie: null };
  }
  const consent = reused ?? { version: MP_CONNECT_CONSENT_VERSION, ackAt: now, userId: input.ownerId, textSha256 };
  const started = beginMercadoPagoConnect({ businessId: input.businessId, returnTo, now, env: input.env });
  const state = new URL(started.authorizationUrl).searchParams.get("state");
  if (!state) throw new Error("state ausente");
  await store.saveOAuthState({
    state,
    businessId: input.businessId,
    returnTo: started.returnTo,
    consentVersion: consent.version,
    consentTextSha256: consent.textSha256,
    autoRefundAckAt: consent.ackAt,
    consentUserId: consent.userId,
    expiresAt: new Date(now.getTime() + MP_OAUTH_COOKIE_MAX_AGE_SECONDS * 1000),
  });
  return { kind: "redirect", location: started.authorizationUrl, cookie: started.cookie };
}

export type MpConsentAccept =
  | { kind: "ok"; status: MpOwnerStatus }
  | { kind: "error"; status: 400 | 403 | 409; body: { error: { code: string; message: string } } };

/**
 * Grava o aceite da versão vigente sem abrir o Mercado Pago de novo.
 * Conta `needs_reconnect` ou sem token exige reconectar.
 */
export async function acceptMercadoPagoConsent(input: {
  request: Request;
  businessId: string;
  ownerId: string;
  now?: Date;
  env?: Readonly<Record<string, string | undefined>>;
  store?: MpConnectionStore;
}): Promise<MpConsentAccept> {
  const auth = authEnvSchema.safeParse(input.env ?? process.env);
  if (!auth.success) throw new HttpError(503, "mp_oauth_unconfigured", "A conexão com o Mercado Pago ainda não está configurada.");
  const now = input.now ?? new Date();
  if (!sameOrigin(input.request, new URL(auth.data.BETTER_AUTH_URL).origin)) {
    return { kind: "error", status: 403, body: { error: { code: "forbidden_origin", message: "Essa origem não pode registrar o aceite." } } };
  }
  const fields = await readConnectFields(input.request);
  if (!(isAutoRefundAck(fields.autoRefundAck) && fields.consentVersion === MP_CONNECT_CONSENT_VERSION)) {
    return { kind: "error", status: 400, body: { error: { code: "auto_refund_ack_required", message: "Marque que você entendeu a devolução automática." } } };
  }
  const store = input.store ?? createDrizzleMpStore();
  const textSha256 = createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex");
  const outcome = await store.withBusinessLock(input.businessId, async (lock) => {
    const row = await lock.read();
    if (!row || row.status === "disconnected") {
      return { ok: false as const, status: 409 as const, code: "mp_account_not_connected", message: "Conecte a conta Mercado Pago deste negócio no AgendaPix para cobrar sinal." };
    }
    if (row.status !== "connected" || !row.accessTokenEnc) {
      return { ok: false as const, status: 409 as const, code: "mp_reconnect_required", message: "O Mercado Pago encerrou a conexão. Reconecte a conta para aceitar o texto novo." };
    }
    await lock.write({
      ...row,
      consentVersion: MP_CONNECT_CONSENT_VERSION,
      consentTextSha256: textSha256,
      autoRefundAckAt: now,
      consentUserId: input.ownerId,
    });
    return { ok: true as const };
  });
  if (!outcome.ok) {
    return { kind: "error", status: outcome.status, body: { error: { code: outcome.code, message: outcome.message } } };
  }
  await store.recordConnectionEvent({
    businessId: input.businessId,
    kind: "consent_recorded",
    ip: requestClientIp(input.request),
    detail: null,
    createdAt: now,
  });
  const status = await getMercadoPagoOwnerStatus(input.businessId, { store, now, env: input.env });
  await invalidatePublicCatalogForBusiness(input.businessId);
  return { kind: "ok", status };
}

export function assertPlaintextAbsent(serialized: string, secrets: string[]) {
  return secrets.every((secret) => secret.length > 0 && !serialized.includes(secret));
}

export function redirectUrl(path: string, config: MpOAuthConfig) {
  return new URL(path, config.origin);
}
