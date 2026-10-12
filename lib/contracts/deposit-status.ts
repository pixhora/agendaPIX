import { z } from "zod";

/** Estado do sinal na agenda do dono. `none` = sem sinal. `auto_refunded` = estorno tardio feito pelo AgendaPix. */
export const depositStatusSchema = z.enum(["none", "paid", "refunded", "charged_back", "auto_refunded"]);
export type DepositStatus = z.infer<typeof depositStatusSchema>;

export const depositReversalReasonSchema = z.enum(["refunded", "charged_back"]);
export type DepositReversalReason = z.infer<typeof depositReversalReasonSchema>;

export const ownerAgendaBookingSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending_payment", "confirmed", "cancelled", "expired", "completed"]),
  depositCents: z.number().int().nonnegative(),
  depositStatus: depositStatusSchema,
  depositReversalSeenAt: z.string().nullable(),
}).passthrough();

export const ownerAgendaResponseSchema = z.object({
  bookings: z.array(ownerAgendaBookingSchema),
  reversedDepositsPendingCount: z.number().int().nonnegative(),
});
export type OwnerAgendaResponse = z.infer<typeof ownerAgendaResponseSchema>;

export const depositReversalAckResponseSchema = z.object({
  bookingId: z.uuid(),
  depositStatus: depositReversalReasonSchema,
  depositReversalSeenAt: z.iso.datetime(),
});
export type DepositReversalAckResponse = z.infer<typeof depositReversalAckResponseSchema>;

export function deriveDepositStatus(input: {
  depositCents: number;
  bookingStatus: string;
  paymentStatus: string | null;
  refundStatus: string | null;
  reversalReason: DepositReversalReason | null;
  autoLateRefund: boolean;
}): DepositStatus {
  if (input.depositCents <= 0) return "none";
  if (input.reversalReason === "charged_back") return "charged_back";
  if (input.reversalReason === "refunded") return "refunded";
  if (input.autoLateRefund) return "auto_refunded";
  if (input.paymentStatus === "refunded" || input.refundStatus === "refunded") return "refunded";
  if (input.paymentStatus === "paid" || input.bookingStatus === "confirmed" || input.bookingStatus === "completed") return "paid";
  return "none";
}
