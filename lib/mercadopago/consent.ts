/** Versão do texto de consentimento da devolução automática. Módulo sem código de servidor, para o front importar. */
export const MP_CONNECT_CONSENT_VERSION = "2026-10-09.v4";

/**
 * Texto exato aceito pelo dono. O servidor grava o SHA-256 hex deste valor, sem markdown.
 * A política efetiva hoje é `refund`: todo Pix pago depois do prazo da reserva é devolvido,
 * mesmo com o horário livre. O dono não tem tela para mudar isso.
 */
export const MP_CONNECT_CONSENT_TEXT = "Entendi e autorizo: quando um Pix chegar depois do prazo para reservar o horário, o AgendaPix devolve sozinho o valor inteiro, do saldo da minha conta Mercado Pago, e me avisa por e-mail. Se essa devolução falhar, eu devolvo manualmente em até 7 dias corridos, contados do aviso.";

/** A versão gravada na conexão é a atual e houve um aceite com data. */
export function storedConsentIsCurrent(version: string | null | undefined, acknowledgedAt: Date | string | null | undefined) {
  return version === MP_CONNECT_CONSENT_VERSION && acknowledgedAt != null;
}

/** Checkbox do formulário (`on`), JSON (`true`) ou valor explícito `1` / `true`. */
export function isAutoRefundAck(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}
