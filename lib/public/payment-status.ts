import { z } from "zod";

const bookingStatusSchema = z.enum(["pending_payment", "confirmed", "cancelled", "expired", "completed"]);

const paymentStatusSchema = z.enum([
  "pending",
  "creating",
  "paid",
  "expired",
  "cancelled",
  "failed",
  "refunded",
  "refund_pending",
]);

const latePaymentPolicySchema = z.enum(["refund", "rebook_if_free"]);

/**
 * `policy` é o texto do sinal guardado na reserva, ou null.
 * `latePaymentPolicy` só entra se o payload já trouxer; sem ele a cópia é a de política desconhecida.
 */
const paymentStatusPolicySchema = z.object({
  text: z.string().nullable().optional(),
  snapshot: z.object({
    latePaymentPolicy: latePaymentPolicySchema.optional(),
  }).passthrough().nullable().optional(),
  latePaymentPolicy: latePaymentPolicySchema.nullable().optional(),
  refundDeadlineAt: z.string().nullable().optional(),
  rescheduleDeadlineAt: z.string().nullable().optional(),
  refundWindowClosedAtBooking: z.boolean().optional(),
}).passthrough();

const pixPaymentSchema = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  status: paymentStatusSchema,
  expiresAt: z.string().nullable(),
  qrCodeDataUrl: z.string().nullable(),
  copyPaste: z.string().nullable(),
});

/** Corpo 200 de GET /api/public/[slug]/bookings/[id]/payment. */
export const paymentStatusResponseSchema = z.object({
  bookingId: z.string(),
  status: bookingStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  expiresAt: z.string().nullable(),
  payment: pixPaymentSchema.nullable(),
  policy: paymentStatusPolicySchema.nullable(),
});

export type PaymentStatusResponse = z.infer<typeof paymentStatusResponseSchema>;

export const publicApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export function parsePaymentStatusResponse(input: unknown): PaymentStatusResponse {
  return paymentStatusResponseSchema.parse(input);
}
