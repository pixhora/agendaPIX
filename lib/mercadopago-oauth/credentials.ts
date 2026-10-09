import { storedConsentIsCurrent } from "../mercadopago/consent";
import { accountIdLast4 } from "./account-profile";
import { mpOAuthConfig } from "./config";
import { decryptMpToken } from "./crypto";
import { createDrizzleMpStore } from "./repository";
import { disconnectedTokensReadyToPurge, MP_REFRESH_ON_DEMAND_WINDOW_MS, refreshMercadoPagoConnection, type RefreshDeps } from "./refresh";
import type { MpConnection, MpConnectionStore } from "./types";

function storeOf(deps?: RefreshDeps): MpConnectionStore {
  return deps?.store ?? createDrizzleMpStore();
}

/** Token do vendedor para o PR de pagamentos. Renova se faltar menos de 1 dia para expirar. */
export async function getSellerAccessToken(businessId: string, deps?: RefreshDeps): Promise<{ accessToken: string; mpUserId: string } | null> {
  const config = mpOAuthConfig(deps?.env);
  const result = await refreshMercadoPagoConnection(businessId, { ...deps, windowMs: deps?.windowMs ?? MP_REFRESH_ON_DEMAND_WINDOW_MS });
  if (result.outcome === "missing" || result.outcome === "needs_reconnect" || !result.connection.accessTokenEnc) return null;
  try {
    return {
      accessToken: decryptMpToken(result.connection.accessTokenEnc, businessId, "access", config.encryptionKey),
      mpUserId: result.connection.mpUserId,
    };
  } catch {
    return null;
  }
}

/** Negócio com a conta MP ainda conectada. Não devolve linhas em needs_reconnect. */
export async function findBusinessIdByMpUserId(mpUserId: string, deps?: RefreshDeps): Promise<string | null> {
  if (!mpUserId.trim()) return null;
  return storeOf(deps).findConnectedBusinessId(mpUserId);
}

export async function isMpConnected(businessId: string, deps?: RefreshDeps): Promise<boolean> {
  const row = await storeOf(deps).findByBusinessId(businessId);
  return connectionCanCharge(row, deps?.now ?? new Date());
}

/** Conexão usada na reserva com sinal. `liveMode` null não é modo de teste. `consentCurrent` só entra na cobrança nova. */
export async function readMpDepositGate(businessId: string, deps?: RefreshDeps): Promise<{ mpConnected: boolean; liveMode: boolean | null; consentCurrent: boolean }> {
  const row = await storeOf(deps).findByBusinessId(businessId);
  const now = deps?.now ?? new Date();
  const gate = depositGate(row, now);
  return {
    mpConnected: gate.connected,
    liveMode: row?.liveMode ?? null,
    consentCurrent: gate.consentCurrent,
  };
}

function connectionCanCharge(row: MpConnection | null, now: Date) {
  return Boolean(row && row.status === "connected" && row.accessTokenEnc && row.refreshTokenEnc && row.expiresAt && row.expiresAt.getTime() > now.getTime());
}

/** Conta ligada para liquidar Pix. `consentCurrent` só entra na cobrança nova. */
export function depositGate(row: MpConnection | null, now: Date) {
  const connected = connectionCanCharge(row, now);
  return { connected, consentCurrent: connected && storedConsentIsCurrent(row?.consentVersion, row?.autoRefundAckAt) };
}

export type MpOwnerStatus = {
  status: "not_connected" | "connected" | "needs_reconnect";
  connectedAt: string | null;
  expiresAt: string | null;
  liveMode: boolean | null;
  canReceiveDeposits: boolean;
  consentVersion: string | null;
  accountName: string | null;
  accountEmailMasked: string | null;
  accountIdLast4: string | null;
};

/** Status visto pelo dono. `disconnected` (desconexão nossa) aparece como `not_connected` e não revela token nem mp_user_id. */
export async function getMercadoPagoOwnerStatus(businessId: string, deps?: RefreshDeps): Promise<MpOwnerStatus> {
  const now = deps?.now ?? new Date();
  const row = await storeOf(deps).findByBusinessId(businessId);
  const consentVersion = row?.consentVersion ?? null;
  const hidden = { accountName: null, accountEmailMasked: null, accountIdLast4: null };
  if (!row || row.status === "disconnected") {
    return { status: "not_connected", connectedAt: null, expiresAt: null, liveMode: null, canReceiveDeposits: false, consentVersion, ...hidden };
  }
  const account = {
    accountName: row.accountDisplayName,
    accountEmailMasked: row.accountEmailMasked,
    accountIdLast4: accountIdLast4(row.mpUserId),
  };
  if (row.status === "needs_reconnect") {
    return {
      status: "needs_reconnect",
      connectedAt: row.connectedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      liveMode: row.liveMode,
      canReceiveDeposits: false,
      consentVersion,
      ...account,
    };
  }
  return {
    status: "connected",
    connectedAt: row.connectedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    liveMode: row.liveMode,
    canReceiveDeposits: depositGate(row, now).consentCurrent,
    consentVersion,
    ...account,
  };
}

/**
 * Desconecta do nosso lado. Sem Pix em aberto, apaga os tokens na mesma chamada.
 * Com Pix `creating`/`pending` ainda no prazo, guarda o par só para confirmar ou devolver
 * e o reconciliador (e o webhook, quando o Pix se resolve) apaga em seguida.
 */
export async function disconnectMercadoPago(businessId: string, deps?: RefreshDeps) {
  const store = storeOf(deps);
  const row = await store.findByBusinessId(businessId);
  if (!row || row.status === "disconnected") return;
  const now = deps?.now ?? new Date();
  await store.markDisconnected(businessId, now);
  const pendingExpiresAt = await store.latestPendingDepositExpiresAt(businessId);
  if (disconnectedTokensReadyToPurge(pendingExpiresAt, now)) await store.clearDisconnectedTokens(businessId);
}

/**
 * Token para consultar ou confirmar um pagamento já criado.
 * Funciona com `disconnected` enquanto o ciphertext existir. Não renova o par e não serve para criar cobrança.
 * `needs_reconnect` (revogação no MP) devolve null: a doc diz que a revogação apaga os tokens lá.
 */
export async function getSellerAccessTokenForSettlement(businessId: string, deps?: RefreshDeps): Promise<{ accessToken: string; mpUserId: string } | null> {
  const row = await storeOf(deps).findByBusinessId(businessId);
  if (!row || row.status === "needs_reconnect" || (row.status !== "connected" && row.status !== "disconnected") || !row.accessTokenEnc) return null;
  const config = mpOAuthConfig(deps?.env);
  try {
    return { accessToken: decryptMpToken(row.accessTokenEnc, businessId, "access", config.encryptionKey), mpUserId: row.mpUserId };
  } catch {
    return null;
  }
}
