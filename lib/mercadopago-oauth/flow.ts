import { findOwnedBusiness } from "../tenancy";
import { mpOAuthConfig, type MpOAuthConfig } from "./config";
import { encryptMpToken } from "./crypto";
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
  const verifier = createCodeVerifier();
  const challenge = codeChallengeS256(verifier);
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Não enviamos `scope`: a doc lista read, write e offline_access, e o padrão da aplicação já inclui write.
  // Pedir um subconjunto poderia restringir a escrita usada no estorno.
  const cookie = sealMpOAuthState({
    state,
    verifier,
    businessId: input.businessId,
    returnTo,
    exp: now.getTime() + MP_OAUTH_COOKIE_MAX_AGE_SECONDS * 1000,
  }, config.authSecret);
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
  const exchanged = await requestMpToken({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: opened.payload.verifier,
  }, input.fetchImpl);
  if (!exchanged.ok) {
    const reason: MpCallbackReason = exchanged.reason === "expired_code" ? "expired_code" : "exchange_failed";
    return { path: mpResultPath(returnTo, { mp: "error", reason }) };
  }
  const store = input.store ?? createDrizzleMpStore();
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
  });
  if (saved === "already_linked_elsewhere") return { path: mpResultPath(returnTo, { mp: "error", reason: "already_linked_elsewhere" }) };
  return { path: mpResultPath(returnTo, { mp: "connected" }) };
}

export function assertPlaintextAbsent(serialized: string, secrets: string[]) {
  return secrets.every((secret) => secret.length > 0 && !serialized.includes(secret));
}

export function redirectUrl(path: string, config: MpOAuthConfig) {
  return new URL(path, config.origin);
}
