/**
 * Versão do texto de consentimento. Subiu de `2026-10-08.v3.2` porque o texto mudou.
 * Comparação em memória: sem migration. Quem já aceitou a versão antiga precisa aceitar de novo.
 */
export const MP_CONNECT_CONSENT_VERSION = "2026-10-09.v4";

/** Aceite geral. A tela de conexão não mostra a política escolhida, então o texto traz as duas regras. */
export const MP_CONNECT_CONSENT_TEXT =
  "Entendi e autorizo: quando um Pix chega depois do prazo, o AgendaPix pede a devolução do valor ao Mercado Pago, sem você precisar fazer nada. Na política padrão, todo Pix atrasado é devolvido. Se você escolher remarcar quando o horário estiver livre, a reserva é confirmada se o horário ainda estiver disponível e o valor é devolvido se não estiver. Se essa devolução falhar, eu devolvo manualmente em até 7 dias corridos, contados do aviso.";

/** Checkbox do formulário (`on`), JSON (`true`) ou valor explícito `1` / `true`. */
export function isAutoRefundAck(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}
