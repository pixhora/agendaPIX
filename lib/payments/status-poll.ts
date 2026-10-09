import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { claimPaymentGatewayPoll } from "../bookings/rate-limit";
import { callProvider } from "./timeout";
import { polledPaidEvent, type PaymentProvider, type ProviderCharge } from "./provider";

type Database = NodePgDatabase<typeof schema>;

/** Hold vencido há pouco ainda merece uma consulta: o Pix pode ter liquidado no fim da reserva. */
export const PAYMENT_GATEWAY_POLL_GRACE_MS = 5 * 60_000;

type PollablePayment = {
  status: string;
  externalId: string | null;
  expiresAt: Date | string;
};

export function shouldPollGateway(payment: PollablePayment | null | undefined, now: Date) {
  if (!payment || payment.status !== "pending" || !payment.externalId) return false;
  const expiresAt = payment.expiresAt instanceof Date ? payment.expiresAt.getTime() : new Date(payment.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;
  return now.getTime() <= expiresAt + PAYMENT_GATEWAY_POLL_GRACE_MS;
}

/**
 * Consulta o gateway fora de transação e, se pago, aplica pelo mesmo caminho do webhook.
 * `false`: não era a vez, o gateway não confirmou, ou a chamada falhou (a resposta local segue).
 * `true`: houve tentativa de aplicar; o chamador relê a reserva.
 */
export async function refreshPaidFromGateway(input: {
  database: Database;
  businessId: string;
  paymentId: string;
  externalId: string;
  provider: PaymentProvider;
  timeoutMs: number;
  now: Date;
}) {
  const { database, businessId, paymentId, externalId, provider, timeoutMs, now } = input;
  if (!await claimPaymentGatewayPoll(database, businessId, paymentId)) return false;
  let remote: ProviderCharge | null;
  try {
    remote = await callProvider(timeoutMs, (signal) => provider.getCharge(externalId, { signal, businessId }));
  } catch {
    return false;
  }
  if (!remote || remote.status !== "paid" || !remote.paidAt) return false;
  try {
    const [{ applyPaidEvent }, { hash }, { drizzleRefundPorts, settleAutomaticLateRefund }] = await Promise.all([
      import("./apply-paid"),
      import("../bookings/service"),
      import("./refund-flow"),
    ]);
    const outcome = await database.transaction((tx) => applyPaidEvent(tx, provider.name, polledPaidEvent(remote, hash), now));
    if (outcome.reason === "late_no_slot" && outcome.paymentId) {
      try {
        await settleAutomaticLateRefund(drizzleRefundPorts(database), provider, outcome.paymentId);
      } catch {
        // A reconciliação retoma o estorno. A consulta do cliente continua com o estado já gravado.
      }
    }
  } catch {
    // Conflito de evento ou corrida com o webhook: a releitura mostra o efeito único.
  }
  return true;
}
