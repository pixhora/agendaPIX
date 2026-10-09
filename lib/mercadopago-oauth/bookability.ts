import { HttpError } from "../http";
import { MP_ACCOUNT_NOT_CONNECTED, MP_CONSENT_OUTDATED } from "../mercadopago/contract";
import { depositGate, isMpConnected } from "./credentials";
import { createDrizzleMpStore } from "./repository";
import type { RefreshDeps } from "./refresh";

export type MpBlockedReason = typeof MP_ACCOUNT_NOT_CONNECTED | typeof MP_CONSENT_OUTDATED;

export const MP_CONSENT_OUTDATED_MESSAGE = "Aceite o texto novo da devolução automática para voltar a receber sinal.";

/**
 * Serviço sem sinal continua agendável. Serviço com sinal exige conta conectada
 * e o texto de consentimento vigente. Versão diferente pausa só reserva nova.
 */
export function getServiceBlockedReason(
  service: { depositCents: number },
  context: { mpConnected: boolean; consentCurrent?: boolean },
): MpBlockedReason | null {
  if (service.depositCents <= 0) return null;
  if (!context.mpConnected) return MP_ACCOUNT_NOT_CONNECTED;
  if (context.consentCurrent === false) return MP_CONSENT_OUTDATED;
  return null;
}

export async function readDepositGate(businessId: string, deps?: RefreshDeps) {
  const store = deps?.store ?? createDrizzleMpStore();
  const row = await store.findByBusinessId(businessId);
  return depositGate(row, deps?.now ?? new Date());
}

export async function assertMpConnectedForDeposit(businessId: string, deps?: RefreshDeps) {
  const gate = await readDepositGate(businessId, deps);
  if (!gate.connected) {
    throw new HttpError(409, MP_ACCOUNT_NOT_CONNECTED, "Conecte a conta Mercado Pago deste negócio no AgendaPix para cobrar sinal.");
  }
  if (!gate.consentCurrent) {
    throw new HttpError(409, MP_CONSENT_OUTDATED, MP_CONSENT_OUTDATED_MESSAGE);
  }
}

export { isMpConnected };
