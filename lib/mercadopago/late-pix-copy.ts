/** Política de Pix atrasado já gravada no negócio. A tela só usa quando esse valor está visível. */
export type LatePixPolicyChoice = "refund" | "rebook_if_free";

export const LATE_PIX_REFUND_LEAD =
  "Quando um Pix chega depois do prazo, o AgendaPix pede a devolução do valor ao Mercado Pago, sem você precisar fazer nada.";

export const LATE_PIX_REFUND_DEFAULT =
  "Na política padrão, todo Pix atrasado é devolvido.";

export const LATE_PIX_REFUND_REBOOK =
  "Se você escolher remarcar quando o horário estiver livre, a reserva é confirmada se o horário ainda estiver disponível e o valor é devolvido se não estiver.";

/**
 * Texto completo quando a tela não mostra a política escolhida.
 * Com `refund` ou `rebook_if_free`, só a frase dessa política.
 */
export function latePixRefundCopy(policy?: LatePixPolicyChoice | null): string {
  if (policy === "refund") return `${LATE_PIX_REFUND_LEAD} ${LATE_PIX_REFUND_DEFAULT}`;
  if (policy === "rebook_if_free") return `${LATE_PIX_REFUND_LEAD} ${LATE_PIX_REFUND_REBOOK}`;
  return `${LATE_PIX_REFUND_LEAD} ${LATE_PIX_REFUND_DEFAULT} ${LATE_PIX_REFUND_REBOOK}`;
}
