import type { BookingResponse, PaymentStatusResponse, PixPaymentStatus } from "./types";
import { resolvePixQr } from "./pix-qr";

/** Fase anunciável na tela de Pix (contrato interno do provider). */
export type PixUiPhase = "pending" | "confirming" | "paid" | "expired" | "cancelled" | "charge_failed" | "refund_pending" | "refunded";

export const CONFIRMING_PAYMENT_LABEL = "Confirmando pagamento";

/**
 * Deriva a fase da UI a partir do status da reserva e do pagamento.
 * Confirmado só quando a reserva em si está confirmada ou concluída.
 * Pix pago com reserva vencida ou cancelada vai para devolução, nunca para sucesso.
 */
export function pixUiPhase(
  data: Pick<BookingResponse, "status" | "payment"> | Pick<PaymentStatusResponse, "status" | "payment"> | null | undefined,
): PixUiPhase {
  if (!data) return "pending";
  const paymentStatus = data.payment?.status;
  if (paymentStatus === "refunded") return "refunded";
  if (paymentStatus === "refund_pending") return "refund_pending";
  if (data.status === "confirmed" || data.status === "completed") return "paid";
  if (paymentStatus === "paid" && data.status === "pending_payment") return "confirming";
  if (paymentStatus === "paid" && (data.status === "expired" || data.status === "cancelled")) return "refund_pending";
  if (data.status === "expired" || paymentStatus === "expired") return "expired";
  if (data.status === "cancelled" || paymentStatus === "cancelled") return "cancelled";
  if (paymentStatus === "failed") return "charge_failed";
  return "pending";
}

export function isFailedPixCharge(payment: { status?: string | null } | null | undefined): boolean {
  return payment?.status === "failed";
}

export function isPixQrUsable(
  payment: { status: PixPaymentStatus; qrCodeDataUrl: string | null; copyPaste: string | null } | null | undefined,
): boolean {
  return Boolean(
    payment?.status === "pending"
      && resolvePixQr(payment.qrCodeDataUrl)
      && payment.copyPaste,
  );
}
