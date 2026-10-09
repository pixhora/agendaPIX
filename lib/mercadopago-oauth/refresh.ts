import { HttpError } from "../http";
import { syncAccountProfile } from "./account-profile";
import { mpOAuthConfig } from "./config";
import { decryptMpToken, encryptMpToken } from "./crypto";
import { createDrizzleMpStore } from "./repository";
import { requestMpToken, type MpFetch } from "./token-client";
import type { MpConnection, MpConnectionStore } from "./types";

export const MP_REFRESH_CRON_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const MP_REFRESH_ON_DEMAND_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RefreshDeps = {
  now?: Date;
  windowMs?: number;
  env?: Readonly<Record<string, string | undefined>>;
  fetchImpl?: MpFetch;
  store?: MpConnectionStore;
  profileTimeoutMs?: number;
};

export type RefreshResult =
  | { outcome: "fresh" | "refreshed"; connection: MpConnection }
  | { outcome: "needs_reconnect"; connection: MpConnection }
  | { outcome: "missing" };

function needsReconnect(connection: MpConnection, lastError: string): MpConnection {
  return { ...connection, status: "needs_reconnect", accessTokenEnc: null, refreshTokenEnc: null, lastError, disconnectedAt: null };
}

/**
 * Sem Pix `creating`/`pending`, apaga. Com `expires_at` no futuro, guarda o token
 * para confirmar ou devolver. Com o prazo já vencido, apaga: o Pix não está mais em aberto.
 */
export function disconnectedTokensReadyToPurge(pendingExpiresAt: Date | null, now: Date) {
  if (!pendingExpiresAt) return true;
  return pendingExpiresAt.getTime() <= now.getTime();
}

/**
 * Renova o par de tokens dentro do lock do negócio. O refresh token do MP é de uso único e rotaciona.
 */
export async function refreshMercadoPagoConnection(businessId: string, deps: RefreshDeps = {}): Promise<RefreshResult> {
  const config = mpOAuthConfig(deps.env);
  const now = deps.now ?? new Date();
  const windowMs = deps.windowMs ?? MP_REFRESH_ON_DEMAND_WINDOW_MS;
  const store = deps.store ?? createDrizzleMpStore();
  const result = await store.withBusinessLock(businessId, async (lock): Promise<RefreshResult> => {
    const current = await lock.read();
    if (!current || current.status !== "connected" || !current.accessTokenEnc || !current.refreshTokenEnc || !current.expiresAt) {
      return current?.status === "needs_reconnect" ? { outcome: "needs_reconnect" as const, connection: current } : { outcome: "missing" as const };
    }
    if (current.expiresAt.getTime() >= now.getTime() + windowMs) return { outcome: "fresh" as const, connection: current };
    let refreshToken: string;
    try { refreshToken = decryptMpToken(current.refreshTokenEnc, businessId, "refresh", config.encryptionKey); }
    catch {
      const connection = needsReconnect(current, "token_unreadable");
      await lock.write(connection);
      return { outcome: "needs_reconnect" as const, connection };
    }
    const exchanged = await requestMpToken({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }, deps.fetchImpl);
    if (!exchanged.ok) {
      if (exchanged.reason === "invalid_grant") {
        const connection = needsReconnect(current, "invalid_grant");
        await lock.write(connection);
        return { outcome: "needs_reconnect", connection };
      }
      throw new HttpError(503, "mp_oauth_refresh_failed", "Não foi possível renovar a conexão com o Mercado Pago. Tente de novo mais tarde.");
    }
    const connection: MpConnection = {
      ...current,
      mpUserId: exchanged.tokens.mpUserId,
      accessTokenEnc: encryptMpToken(exchanged.tokens.accessToken, businessId, "access", config.encryptionKey),
      refreshTokenEnc: encryptMpToken(exchanged.tokens.refreshToken, businessId, "refresh", config.encryptionKey),
      publicKey: exchanged.tokens.publicKey,
      scope: exchanged.tokens.scope,
      liveMode: exchanged.tokens.liveMode,
      expiresAt: new Date(now.getTime() + exchanged.tokens.expiresIn * 1000),
      refreshedAt: now,
      status: "connected",
      lastError: null,
      disconnectedAt: null,
    };
    await lock.write(connection);
    return { outcome: "refreshed" as const, connection };
  });
  if (result.outcome !== "refreshed" || result.connection.accountDisplayName || result.connection.accountEmailMasked || !result.connection.accessTokenEnc) {
    return result;
  }
  try {
    const accessToken = decryptMpToken(result.connection.accessTokenEnc, businessId, "access", config.encryptionKey);
    await syncAccountProfile({
      businessId,
      accessToken,
      store,
      fetchImpl: deps.fetchImpl,
      now,
      timeoutMs: deps.profileTimeoutMs,
    });
    const updated = await store.findByBusinessId(businessId);
    if (updated) return { outcome: "refreshed", connection: updated };
  } catch {
    // Perfil ausente não desfaz o par de tokens já renovado.
  }
  return result;
}

export async function refreshDueMercadoPagoConnections(deps: RefreshDeps = {}) {
  const now = deps.now ?? new Date();
  const store = deps.store ?? createDrizzleMpStore();
  const ids = await store.listRefreshCandidates(new Date(now.getTime() + MP_REFRESH_CRON_WINDOW_MS));
  const counts = { checked: ids.length, refreshed: 0, needsReconnect: 0, failed: 0 };
  for (const businessId of ids) {
    try {
      const result = await refreshMercadoPagoConnection(businessId, { ...deps, now, windowMs: MP_REFRESH_CRON_WINDOW_MS, store });
      if (result.outcome === "refreshed") counts.refreshed += 1;
      else if (result.outcome === "needs_reconnect") counts.needsReconnect += 1;
    } catch {
      counts.failed += 1;
    }
  }
  return counts;
}

/** Apaga tokens de contas desconectadas por nós quando não há Pix em aberto dentro do prazo. */
export async function purgeDisconnectedMercadoPagoTokens(deps: RefreshDeps = {}) {
  const now = deps.now ?? new Date();
  const store = deps.store ?? createDrizzleMpStore();
  const rows = await store.listDisconnectedWithTokens();
  let purged = 0;
  for (const row of rows) {
    const pendingExpiresAt = await store.latestPendingDepositExpiresAt(row.businessId);
    if (!disconnectedTokensReadyToPurge(pendingExpiresAt, now)) continue;
    await store.clearDisconnectedTokens(row.businessId);
    purged += 1;
  }
  return { purged };
}
