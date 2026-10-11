import { z } from "zod";

/**
 * Motivo interno da recusa ao criar o Pix. Só entra no log do servidor.
 * A resposta pública de agendamento não devolve este código.
 *
 * `mp_pix_key_missing` e `mp_account_not_enabled` estão reservados. A referência
 * de POST /v1/payments não publica um cause code para chave Pix ausente nem para
 * conta do cobrador desabilitada, então o classificador não os emite.
 */
export const MP_PIX_CREATE_FAILURE_REASONS = [
  "mp_pix_key_missing",
  "mp_account_not_enabled",
  "mp_unauthorized",
  "mp_invalid_amount",
  "mp_unknown",
] as const;

export const mpPixCreateFailureReasonSchema = z.enum(MP_PIX_CREATE_FAILURE_REASONS);

export type MpPixCreateFailureReason = z.infer<typeof mpPixCreateFailureReasonSchema>;
