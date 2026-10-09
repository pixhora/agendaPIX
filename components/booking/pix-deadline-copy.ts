import type { LatePixPolicyChoice } from "@/lib/mercadopago/late-pix-copy";
import {
  REFUNDED_TITLE,
  REFUND_PENDING_TITLE,
  refundPendingBody,
  refundedBody,
} from "./customer-copy";

/** Janela extra de conferência depois que o prazo do Pix acaba. */
export const LATE_PAYMENT_WATCH_MS = 3 * 60 * 1000;

export const LATE_PAYMENT_WATCH_LINE = "Conferindo pagamentos recentes…";

export const EXPIRED_PIX_TITLE = "O prazo para pagar terminou";

export const CHOOSE_ANOTHER_SLOT_LABEL = "Escolher outro horário";

const EXPIRED_REBOOK =
  "Se você já pagou, ainda estamos conferindo. Se o horário continuar livre, sua reserva é confirmada aqui mesmo. Se não, o valor é devolvido para a conta que fez o Pix.";

const EXPIRED_REFUND =
  "Se você já pagou, ainda estamos conferindo. Como o prazo terminou, o valor é devolvido para a conta que fez o Pix.";

const EXPIRED_UNKNOWN =
  "Se você já pagou, ainda estamos conferindo. Se o pagamento chegou depois do prazo e o horário não puder ser mantido, o valor é devolvido para a conta que fez o Pix.";

/**
 * Corpo da tela de prazo encerrado.
 * `null` (policy ausente ou sem `latePaymentPolicy`) usa a frase de política desconhecida.
 */
export function latePaymentChoice(policy?: object | null): LatePixPolicyChoice | null {
  if (!policy) return null;
  const record = policy as {
    latePaymentPolicy?: unknown;
    snapshot?: { latePaymentPolicy?: unknown } | null;
  };
  if (record.latePaymentPolicy === "refund" || record.latePaymentPolicy === "rebook_if_free") return record.latePaymentPolicy;
  const nested = record.snapshot?.latePaymentPolicy;
  if (nested === "refund" || nested === "rebook_if_free") return nested;
  return null;
}

export function expiredPixBody(policy?: LatePixPolicyChoice | null): string {
  if (policy === "rebook_if_free") return EXPIRED_REBOOK;
  if (policy === "refund") return EXPIRED_REFUND;
  return EXPIRED_UNKNOWN;
}

/** Corpo da tela de prazo encerrado, na conferência e depois dela. A frase segue a política do sinal. */
export function expiredScreenBody(_watching: boolean, policy?: LatePixPolicyChoice | null): string {
  return expiredPixBody(policy);
}

export function refundPendingCopy(amountLabel: string): { title: string; body: string } {
  return {
    title: REFUND_PENDING_TITLE,
    body: refundPendingBody(amountLabel),
  };
}

export function refundedCopy(amountLabel: string): { title: string; body: string } {
  return {
    title: REFUNDED_TITLE,
    body: refundedBody(amountLabel),
  };
}

export function businessWhatsappLabel(businessName: string): string {
  return `Falar com ${businessName} no WhatsApp`;
}
