import type { PaidEvent } from "./provider";

export function decidePaidEvent(
  payment: { amountCents: number; status: string; expiresAt: Date },
  booking: { depositCents: number; status: string; expiresAt: Date | null; startsAt: Date },
  event: PaidEvent, now: Date,
): { outcome: "processed" | "ignored" | "rejected" | "duplicate"; reason: string | null; recordPaid: boolean; confirm: boolean } {
  if (event.amountCents !== payment.amountCents || payment.amountCents !== booking.depositCents) {
    return { outcome: "rejected", reason: "amount_mismatch", recordPaid: false, confirm: false };
  }
  if (new Date(event.paidAt).getTime() > now.getTime() + 300000) {
    return { outcome: "rejected", reason: "future_payment", recordPaid: false, confirm: false };
  }
  if (payment.status === "paid") return { outcome: "duplicate", reason: null, recordPaid: false, confirm: false };
  if (!["pending", "expired"].includes(payment.status)) return { outcome: "rejected", reason: "invalid_payment_state", recordPaid: false, confirm: false };
  const timely = payment.status === "pending" && new Date(event.paidAt) <= payment.expiresAt && now < payment.expiresAt
    && booking.status === "pending_payment" && booking.expiresAt !== null && now < booking.expiresAt && now < booking.startsAt;
  return timely
    ? { outcome: "processed", reason: null, recordPaid: true, confirm: true }
    : { outcome: "ignored", reason: "late_payment", recordPaid: true, confirm: false };
}
