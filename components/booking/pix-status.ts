import type { BookingResponse, PaymentStatusResponse, PixPaymentStatus } from "./types";
import { resolvePixQr } from "./pix-qr";

/** Fase anunciável na tela de Pix (contrato interno do provider). */
export type PixUiPhase = "pending" | "paid" | "expired" | "cancelled";

/**
 * Deriva a fase da UI a partir do status da reserva e do pagamento.
 * `paid` quando a reserva confirma; terminais de pagamento viram expired/cancelled.
 */
export function pixUiPhase(
  data: Pick<BookingResponse, "status" | "payment"> | Pick<PaymentStatusResponse, "status" | "payment"> | null | undefined,
): PixUiPhase {
  if (!data) return "pending";
  if (data.status === "confirmed" || data.payment?.status === "paid") return "paid";
  if (data.status === "expired" || data.payment?.status === "expired") return "expired";
  if (data.status === "cancelled") return "cancelled";
  const paymentStatus = data.payment?.status;
  if (
    paymentStatus === "cancelled"
    || paymentStatus === "failed"
    || paymentStatus === "refunded"
    || paymentStatus === "refund_pending"
  ) {
    return "cancelled";
  }
  return "pending";
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
