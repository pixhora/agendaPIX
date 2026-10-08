/** Versão do texto de consentimento da devolução automática. Módulo sem código de servidor, para o front importar. */
export const MP_CONNECT_CONSENT_VERSION = "2026-10-08.v3.2";

/** Texto exato aceito pelo dono. O servidor grava o SHA-256 hex deste valor, sem markdown. */
export const MP_CONNECT_CONSENT_TEXT = "Entendi e autorizo: quando um Pix chegar depois do prazo e o horário já estiver ocupado, o AgendaPix devolve sozinho o valor inteiro, do saldo da minha conta Mercado Pago, e me avisa por e-mail. Se essa devolução falhar, eu devolvo manualmente em até 7 dias corridos, contados do aviso.";

/** Checkbox do formulário (`on`), JSON (`true`) ou valor explícito `1` / `true`. */
export function isAutoRefundAck(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}
