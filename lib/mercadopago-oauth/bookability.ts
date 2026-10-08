import { HttpError } from "../http";
import { isMpConnected } from "./credentials";
import type { RefreshDeps } from "./refresh";

export type MpBlockedReason = "mp_account_not_connected";

/**
 * Critério deste PR: serviço sem sinal continua agendável. Serviço com sinal exige conta MP conectada.
 * Outros motivos (trial, política) podem ser acrescentados por quem passar a compor este retorno.
 */
export function getServiceBlockedReason(service: { depositCents: number }, context: { mpConnected: boolean }): MpBlockedReason | null {
  if (service.depositCents <= 0) return null;
  if (!context.mpConnected) return "mp_account_not_connected";
  return null;
}

export async function assertMpConnectedForDeposit(businessId: string, deps?: RefreshDeps) {
  if (!(await isMpConnected(businessId, deps))) {
    throw new HttpError(409, "mp_account_not_connected", "Conecte a conta Mercado Pago deste negócio no AgendaPix para cobrar sinal.");
  }
}

export { isMpConnected };
