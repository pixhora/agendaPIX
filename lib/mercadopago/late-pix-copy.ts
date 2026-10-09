/** Política de Pix atrasado já gravada no negócio. A tela só usa quando esse valor está visível. */
export type LatePixPolicyChoice = "refund" | "rebook_if_free";

export const LATE_PIX_REFUND_LEAD =
  "Quando um Pix chega depois do prazo, o AgendaPix pede a devolução do valor ao Mercado Pago, sem você precisar fazer nada.";

export const LATE_PIX_REFUND_DEFAULT =
  "Na política padrão, todo Pix atrasado é devolvido.";

/** A tela não oferece remarcar. O texto descreve só a devolução automática. */
export function latePixRefundCopy(): string {
  return `${LATE_PIX_REFUND_LEAD} ${LATE_PIX_REFUND_DEFAULT}`;
}
