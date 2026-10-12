import { z } from "zod";

/**
 * Códigos das rotas de perfil, logo e disponibilidade.
 * O corpo de erro é `{ error: { code, message, details? } }`.
 */
export const apiErrorCodeSchema = z.enum([
  "invalid_input",
  "unauthorized",
  "business_unavailable",
  "slug_taken",
  "rate_limited",
  "logo_invalid",
  "logo_too_large",
  "blob_unavailable",
  "internal_error",
  "link_expired",
  "link_used",
  "link_in_progress",
  "link_cancelled",
  "link_replaced",
  "link_invalid",
  "slot_unavailable",
  "mp_not_connected",
  "bookings_paused",
  "invalid_idempotency_key",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorDetailsSchema = z.record(z.string(), z.unknown());

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    details: apiErrorDetailsSchema.optional(),
  }).strict(),
}).strict();

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
