import { PIX_EXPIRATION_MARGIN_MINUTES } from "../bookings/config";
import type { PaidEvent } from "./provider";

/**
 * O Mercado Pago aceita o Pix até `date_of_expiration` = hold + 2 min.
 * Aprovação até esse instante é no prazo, mesmo que o webhook chegue depois.
 * https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/get-payment/get
 */
export const PIX_APPROVAL_TOLERANCE_MS = PIX_EXPIRATION_MARGIN_MINUTES * 60_000;
/** `date_approved` mais à frente que isto, contra o relógio local, não é aprovação confiável. */
export const PAID_AT_FUTURE_SKEW_MS = 5 * 60_000;

/**
 * "No prazo" usa a hora de aprovação (`PaidEvent.paidAt`, no MP o `date_approved`),
 * não o instante em que o sistema processa o evento.
 * `paidAtSource: "fallback"` ou data inválida não prova aprovação: confirma só se o
 * hold ainda segura o horário; senão segue a política de atraso.
 * Reserva já `expired` com aprovação no prazo devolve `on_time_hold_released` para
 * retomar o horário se estiver livre.
 */
export function decidePaidEvent(
  payment: { amountCents: number; status: string; expiresAt: Date },
  booking: { depositCents: number; status: string; expiresAt: Date | null; startsAt: Date },
  event: PaidEvent, now: Date,
): { outcome: "processed" | "ignored" | "rejected" | "duplicate"; reason: string | null; recordPaid: boolean; confirm: boolean } {
  if (event.amountCents !== payment.amountCents || payment.amountCents !== booking.depositCents) {
    return { outcome: "rejected", reason: "amount_mismatch", recordPaid: false, confirm: false };
  }
  const approvedAt = new Date(event.paidAt);
  const approvalKnown = event.paidAtSource !== "fallback" && !Number.isNaN(approvedAt.getTime());
  if (approvalKnown && approvedAt.getTime() > now.getTime() + PAID_AT_FUTURE_SKEW_MS) {
    return { outcome: "rejected", reason: "future_payment", recordPaid: false, confirm: false };
  }
  if (payment.status === "paid") return { outcome: "duplicate", reason: null, recordPaid: false, confirm: false };
  if (!["pending", "expired"].includes(payment.status)) return { outcome: "rejected", reason: "invalid_payment_state", recordPaid: false, confirm: false };

  const beforeStart = now.getTime() < booking.startsAt.getTime();
  const slotStillHeld = booking.status === "pending_payment"
    && booking.expiresAt !== null
    && now.getTime() < booking.expiresAt.getTime()
    && beforeStart;
  const onTime = approvalKnown && approvedAt.getTime() <= payment.expiresAt.getTime() + PIX_APPROVAL_TOLERANCE_MS;

  if (onTime && slotStillHeld) return { outcome: "processed", reason: null, recordPaid: true, confirm: true };
  if (onTime && booking.status === "pending_payment" && booking.expiresAt !== null && beforeStart && (payment.status === "pending" || payment.status === "expired")) {
    return { outcome: "processed", reason: null, recordPaid: true, confirm: true };
  }
  if (onTime && booking.status === "expired" && beforeStart) {
    return { outcome: "ignored", reason: "on_time_hold_released", recordPaid: true, confirm: false };
  }
  if (!approvalKnown && slotStillHeld && payment.status === "pending") {
    return { outcome: "processed", reason: null, recordPaid: true, confirm: true };
  }
  return { outcome: "ignored", reason: "late_payment", recordPaid: true, confirm: false };
}
