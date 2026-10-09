import { HttpError } from "../http";
import { readMpDepositGate } from "./credentials";
import type { RefreshDeps } from "./refresh";

export { isMpConnected, readMpDepositGate } from "./credentials";

export type MpBlockedReason = "mp_account_not_connected" | "mp_account_test_mode";

/** Conta de teste só bloqueia cobrança com o app e a credencial Mercado Pago em produção. Sandbox e dev seguem só com o aviso na tela. */
export function enforceLiveMercadoPagoAccount(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.NODE_ENV === "production" && env.MERCADOPAGO_ENV === "production";
}

/**
 * Serviço sem sinal continua agendável. Serviço com sinal exige conta conectada.
 * Em produção (NODE_ENV e MERCADOPAGO_ENV), live_mode false também bloqueia.
 */
export function getServiceBlockedReason(
  service: { depositCents: number },
  context: { mpConnected: boolean; liveMode?: boolean | null },
  env: Readonly<Record<string, string | undefined>> = process.env,
): MpBlockedReason | null {
  if (service.depositCents <= 0) return null;
  if (!context.mpConnected) return "mp_account_not_connected";
  if (context.liveMode === false && enforceLiveMercadoPagoAccount(env)) return "mp_account_test_mode";
  return null;
}

export async function assertMpConnectedForDeposit(businessId: string, deps?: RefreshDeps) {
  const gate = await readMpDepositGate(businessId, deps);
  const reason = getServiceBlockedReason({ depositCents: 1 }, gate, deps?.env ?? process.env);
  if (reason === "mp_account_not_connected") {
    throw new HttpError(409, "mp_account_not_connected", "Conecte a conta Mercado Pago deste negócio no AgendaPix para cobrar sinal.");
  }
  if (reason === "mp_account_test_mode") {
    throw new HttpError(409, "mp_account_test_mode", "A conta Mercado Pago conectada está em modo de teste. Conecte a conta de produção para o cliente pagar o sinal.");
  }
}
