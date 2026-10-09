/** Política de Pix atrasado já gravada no negócio. A tela só usa quando esse valor está visível. */
export type LatePixPolicyChoice = "refund" | "rebook_if_free";

export const LATE_PIX_REFUND_LEAD =
  "Quando um Pix chega depois do prazo, o AgendaPix pede a devolução do valor ao Mercado Pago, sem você precisar fazer nada.";

export const LATE_PIX_REFUND_DEFAULT =
  "Na política padrão, todo Pix atrasado é devolvido.";

const LATE_PIX_REFUND_SENTENCE = `${LATE_PIX_REFUND_LEAD} ${LATE_PIX_REFUND_DEFAULT}`;

/**
 * A tela não oferece remarcar. As duas políticas usam a mesma frase de devolução.
 * Hoje o chamador passa `refund`, a única política disponível.
 */
export function latePixRefundCopy(policy: LatePixPolicyChoice): string {
  const copy: Record<LatePixPolicyChoice, string> = {
    refund: LATE_PIX_REFUND_SENTENCE,
    rebook_if_free: LATE_PIX_REFUND_SENTENCE,
  };
  return copy[policy];
}
