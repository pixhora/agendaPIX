import { HttpError } from "../http";
import { syncAccountProfile } from "./account-profile";
import { mpOAuthConfig } from "./config";
import { decryptMpToken, encryptMpToken } from "./crypto";
import { createDrizzleMpStore } from "./repository";
import { requestMpToken, type MpFetch } from "./token-client";
import type { DisconnectTokenHold, MpConnection, MpConnectionStore } from "./types";

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

/** Folga depois que o Pix vence, é pago ou é cancelado, para o webhook atrasado ainda conciliar. */
export const MP_DISCONNECT_SETTLEMENT_GRACE_MS = 24 * 60 * 60 * 1000;

function laterInstant(left: Date | null, right: Date | null): Date | null {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

/**
 * Sem Pix em aberto e sem vencimento ou cancelamento recente, apaga na hora.
 * `creating`/`pending` com menos de 7 dias, ou devolução `requested`/`processing`, segura o token.
 * Um `creating` preso há mais de 7 dias entra só como vencimento: não muda status no Mercado Pago.
 * Depois que o último `expires_at` ou `remote_cancelled_at` passou, guarda por mais 24 h.
 */
export function disconnectedTokensReadyToPurge(hold: DisconnectTokenHold, now: Date) {
  if (hold.hasOpenPix) return false;
  const anchor = laterInstant(hold.lastExpiresAt, hold.lastRemoteCancelledAt);
  if (!anchor) return true;
  return now.getTime() - anchor.getTime() > MP_DISCONNECT_SETTLEMENT_GRACE_MS;
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

/** Apaga tokens desconectados. Com `businessId`, só esse negócio; senão, todos. */
export async function purgeDisconnectedMercadoPagoTokens(deps: RefreshDeps & { businessId?: string } = {}) {
  const now = deps.now ?? new Date();
  const store = deps.store ?? createDrizzleMpStore();
  const listed = deps.businessId
    ? [await store.findByBusinessId(deps.businessId)]
    : await store.listDisconnectedWithTokens();
  const rows = listed.filter((row): row is MpConnection => Boolean(row && row.status === "disconnected" && row.accessTokenEnc && row.refreshTokenEnc));
  let purged = 0;
  for (const row of rows) {
    const hold = await store.disconnectTokenHold(row.businessId, now);
    if (!disconnectedTokensReadyToPurge(hold, now)) continue;
    await store.clearDisconnectedTokens(row.businessId);
    purged += 1;
  }
  return { purged };
}
