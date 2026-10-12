import { HttpError } from "../http";

/**
 * Fallback do cliente quando `crypto.randomUUID` não existe.
 * Não identifica uma tentativa: a mesma chave volta a reserva de outro cliente
 * ou responde 409. Recusar antes de ler o banco.
 */
export const BLOCKED_PUBLIC_IDEMPOTENCY_KEY = "00000000-0000-4000-8000-000000000000";

/** Reserva pública e pagamento do link de horário. */
export const INVALID_IDEMPOTENCY_KEY_MESSAGE = "Esta página ficou desatualizada. Atualize e tente de novo. Nenhum Pix foi gerado.";

/** Cadastro do negócio. Não houve Pix nem gravação. */
export const INVALID_ONBOARDING_IDEMPOTENCY_KEY_MESSAGE = "Esta página ficou desatualizada. Atualize e tente de novo. Nada foi salvo ainda.";

export function isBlockedPublicIdempotencyKey(key: string) {
  return key.trim().toLowerCase() === BLOCKED_PUBLIC_IDEMPOTENCY_KEY;
}

export function rejectBlockedIdempotencyKey(key: string, message = INVALID_IDEMPOTENCY_KEY_MESSAGE) {
  if (!isBlockedPublicIdempotencyKey(key)) return;
  throw new HttpError(400, "invalid_idempotency_key", message);
}
