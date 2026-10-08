export const REFUND_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

export const refundStatuses = ["in_process", "refunded", "failed"] as const;
export type RefundStatus = (typeof refundStatuses)[number];

export type RefundBlockReason =
  | "not_paid"
  | "already_refunded"
  | "refund_window_expired"
  | "mp_account_not_connected"
  | "refund_in_process";

export function assessRefund(input: {
  paymentStatus: string;
  refundStatus: RefundStatus | null;
  paidAt: Date | null;
  now: Date;
  settlementAvailable: boolean;
  policyDeadlineAt: Date | null;
}): { eligible: boolean; reason: RefundBlockReason | null } {
  if (input.refundStatus === "refunded" || input.paymentStatus === "refunded") {
    return { eligible: false, reason: "already_refunded" };
  }
  if (input.refundStatus === "in_process") return { eligible: false, reason: "refund_in_process" };
  const paid = input.paymentStatus === "paid" || input.paymentStatus === "refund_pending";
  if (!paid || !input.paidAt) return { eligible: false, reason: "not_paid" };
  if (input.now.getTime() > input.paidAt.getTime() + REFUND_WINDOW_MS) {
    return { eligible: false, reason: "refund_window_expired" };
  }
  if (input.policyDeadlineAt && input.now.getTime() > input.policyDeadlineAt.getTime()) {
    return { eligible: false, reason: "refund_window_expired" };
  }
  if (!input.settlementAvailable) return { eligible: false, reason: "mp_account_not_connected" };
  return { eligible: true, reason: null };
}

export function refundBlockMessage(reason: RefundBlockReason) {
  switch (reason) {
    case "not_paid":
      return "Este sinal ainda não foi pago.";
    case "already_refunded":
      return "Este sinal já foi devolvido.";
    case "refund_window_expired":
      return "O prazo para devolver este sinal pelo AgendaPix já passou.";
    case "mp_account_not_connected":
      return "Conecte o Mercado Pago ao AgendaPix para devolver o sinal.";
    case "refund_in_process":
      return "A devolução deste sinal já está em andamento.";
  }
}
