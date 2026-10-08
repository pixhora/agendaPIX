/** Versão do texto de consentimento da devolução automática. Módulo sem código de servidor, para o front importar. */
export const MP_CONNECT_CONSENT_VERSION = "2026-10-08.v3.2";

/** Checkbox do formulário (`on`), JSON (`true`) ou valor explícito `1` / `true`. */
export function isAutoRefundAck(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}
