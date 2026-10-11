import { z } from "zod";

/**
 * Único detalhe do 503 `payment_unavailable` em POST /api/public/{slug}/bookings.
 * `true`: o pagamento continua `creating` (timeout, rede, 408, 409, 429 ou 5xx);
 * a cobrança pode existir no Mercado Pago e o cliente reusa a mesma chave.
 * `false`: a linha foi marcada `failed` (recusa definitiva) e o cliente usa chave nova.
 * Sem `reason` e sem outros campos.
 */
export const bookingPaymentUnavailableDetailsSchema = z.object({
  retry_same_key: z.boolean(),
}).strict();

export const bookingPaymentUnavailableErrorSchema = z.object({
  error: z.object({
    code: z.literal("payment_unavailable"),
    message: z.string().min(1),
    details: bookingPaymentUnavailableDetailsSchema,
  }).strict(),
}).strict();

export type BookingPaymentUnavailableDetails = z.infer<typeof bookingPaymentUnavailableDetailsSchema>;
export type BookingPaymentUnavailableError = z.infer<typeof bookingPaymentUnavailableErrorSchema>;
