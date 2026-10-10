import { createHash, randomBytes } from "node:crypto";
import {
  SLOT_LINK_PREVIEW_ID_BYTES,
  SLOT_LINK_PREVIEW_ID_PATTERN,
  SLOT_LINK_TOKEN_BYTES,
  SLOT_LINK_TOKEN_PATTERN,
} from "../contracts/slot-link";

/** 32 bytes opacos em base64url. Não carrega dado pessoal. */
export function createSlotLinkToken() {
  return randomBytes(SLOT_LINK_TOKEN_BYTES).toString("base64url");
}

/** Identificador público da prévia. Não deriva o token e não autoriza pagamento. */
export function createSlotLinkPreviewId() {
  return randomBytes(SLOT_LINK_PREVIEW_ID_BYTES).toString("base64url");
}

export function slotLinkTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isSlotLinkToken(value: string) {
  return SLOT_LINK_TOKEN_PATTERN.test(value);
}

export function isSlotLinkPreviewId(value: string) {
  return SLOT_LINK_PREVIEW_ID_PATTERN.test(value);
}

/**
 * Tira o token de textos que possam ir para log. O valor bruto não entra em mensagem de erro.
 * Não há Sentry neste processo; qualquer log futuro precisa passar por aqui.
 */
export function redactSlotLinkToken(value: string) {
  if (isSlotLinkToken(value)) return "[redacted]";
  return value.replace(/(\/slot-links\/)[A-Za-z0-9_-]{43}\b/g, "$1[redacted]");
}
