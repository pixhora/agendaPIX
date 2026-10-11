import type { BookingResponse, PixPaymentStatus } from "@/components/booking/types";
import { slotLinkPayResponseSchema, type SlotLinkPayResponse } from "@/lib/contracts/slot-link";
import { parseContract } from "@/lib/slot-link/parse";

const PAYMENT_STATUSES = new Set<PixPaymentStatus>([
  "pending", "paid", "expired", "cancelled", "creating", "failed", "refunded", "refund_pending",
]);

function paymentStatus(value: string): PixPaymentStatus {
  return PAYMENT_STATUSES.has(value as PixPaymentStatus) ? value as PixPaymentStatus : "pending";
}

export function toBookingResponse(data: SlotLinkPayResponse): BookingResponse {
  const status = data.status === "confirmed" || data.status === "completed" ? "confirmed" : "pending_payment";
  return {
    bookingId: data.bookingId,
    status,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    expiresAt: data.expiresAt,
    accessToken: data.accessToken,
    payment: data.payment
      ? {
          id: data.payment.id,
          provider: data.payment.provider,
          externalId: data.payment.externalId,
          amountCents: data.payment.amountCents,
          status: paymentStatus(data.payment.status),
          expiresAt: data.payment.expiresAt,
          qrCodeDataUrl: data.payment.qrCodeDataUrl,
          copyPaste: data.payment.copyPaste,
        }
      : null,
    policy: data.policy
      ? {
          text: data.policy.text,
          snapshot: null,
          refundDeadlineAt: data.policy.refundDeadlineAt,
          rescheduleDeadlineAt: data.policy.rescheduleDeadlineAt,
          refundWindowClosedAtBooking: data.policy.refundWindowClosedAtBooking,
        }
      : null,
  };
}

export function parsePayResult(body: unknown) {
  return toBookingResponse(parseContract(slotLinkPayResponseSchema, body));
}
