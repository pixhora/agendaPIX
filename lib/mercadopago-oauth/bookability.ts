import { HttpError } from "../http";
import { MP_ACCOUNT_NOT_CONNECTED, MP_CONSENT_OUTDATED } from "../mercadopago/contract";
import { readMpDepositGate } from "./credentials";
import type { RefreshDeps } from "./refresh";

export { isMpConnected, readMpDepositGate } from "./credentials";

export type MpBlockedReason = typeof MP_ACCOUNT_NOT_CONNECTED | typeof MP_CONSENT_OUTDATED | "mp_account_test_mode";

export const MP_CONSENT_OUTDATED_MESSAGE = "Aceite o texto novo da devolução automática para voltar a receber sinal.";

/** Conta de teste só bloqueia cobrança com o app e a credencial Mercado Pago em produção. Sandbox e dev seguem só com o aviso na tela. */
export function enforceLiveMercadoPagoAccount(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.NODE_ENV === "production" && env.MERCADOPAGO_ENV === "production";
}

/**
 * Serviço sem sinal continua agendável. Serviço com sinal exige conta conectada
 * e o texto de consentimento vigente. Versão diferente pausa só reserva nova.
 * Em produção (NODE_ENV e MERCADOPAGO_ENV), live_mode false também bloqueia.
 */
export function getServiceBlockedReason(
  service: { depositCents: number },
  context: { mpConnected: boolean; consentCurrent?: boolean; liveMode?: boolean | null },
  env: Readonly<Record<string, string | undefined>> = process.env,
): MpBlockedReason | null {
  if (service.depositCents <= 0) return null;
  if (!context.mpConnected) return MP_ACCOUNT_NOT_CONNECTED;
  if (context.consentCurrent === false) return MP_CONSENT_OUTDATED;
  if (context.liveMode === false && enforceLiveMercadoPagoAccount(env)) return "mp_account_test_mode";
  return null;
}

export async function assertMpConnectedForDeposit(businessId: string, deps?: RefreshDeps) {
  const gate = await readMpDepositGate(businessId, deps);
  const reason = getServiceBlockedReason({ depositCents: 1 }, gate, deps?.env ?? process.env);
  if (reason === MP_ACCOUNT_NOT_CONNECTED) {
    throw new HttpError(409, MP_ACCOUNT_NOT_CONNECTED, "Conecte a conta Mercado Pago deste negócio no AgendaPix para cobrar sinal.");
  }
  if (reason === MP_CONSENT_OUTDATED) {
    throw new HttpError(409, MP_CONSENT_OUTDATED, MP_CONSENT_OUTDATED_MESSAGE);
  }
  if (reason === "mp_account_test_mode") {
    throw new HttpError(409, "mp_account_test_mode", "A conta Mercado Pago conectada está em modo de teste. Conecte a conta de produção para o cliente pagar o sinal.");
  }
}
