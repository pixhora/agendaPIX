import type { ApiErrorCode } from "@/lib/contracts";

/** Frases da tela. O código da API não aparece para o dono. */
export const PROFILE_ERROR_COPY: Record<ApiErrorCode, string> = {
  invalid_input: "Confira os dados enviados.",
  unauthorized: "Entre na sua conta para continuar.",
  business_unavailable: "Este negócio não está disponível para sua conta.",
  slug_taken: "Esse link já está em uso. Tente outro.",
  rate_limited: "Muitas tentativas. Espere um pouco e tente de novo.",
  logo_invalid: "Formato não aceito. Envie PNG, JPEG ou WebP.",
  logo_too_large: "A imagem passa de 2 MB. O limite é 2 MB.",
  blob_unavailable: "O envio da logo está indisponível.",
  internal_error: "Não deu para salvar agora. Seus dados continuam aqui. Tente de novo.",
  link_expired: "Este link expirou.",
  link_used: "Este horário já foi confirmado.",
  link_in_progress: "Este horário já está em pagamento.",
  link_cancelled: "Este link não está mais disponível.",
  link_replaced: "Este link foi trocado. Peça outro ao negócio.",
  link_invalid: "Este link não está mais disponível.",
  slot_unavailable: "Esse horário acabou de ser reservado.",
  mp_not_connected: "Conecte o Mercado Pago para cobrar sinal.",
  bookings_paused: "Este estabelecimento não está aceitando novos agendamentos no momento.",
  invalid_idempotency_key: "Essa chave não é válida. Tente de novo.",
};

export function profileErrorCopy(code: string, fallback = PROFILE_ERROR_COPY.internal_error): string {
  if (code in PROFILE_ERROR_COPY) return PROFILE_ERROR_COPY[code as ApiErrorCode];
  return fallback;
}
