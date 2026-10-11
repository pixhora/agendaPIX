import { readPolicyChangedUpdate } from "./policy-gate";
import type { PolicyChangedUpdate } from "./types";
import {
  BUSINESS_LOAD_COPY,
  BUSINESS_NOT_FOUND_COPY,
  BUSINESS_SLOW_COPY,
  SLOTS_LOAD_COPY,
  SUBMIT_RETRY_COPY,
} from "./customer-copy";

export const SERVICE_UNAVAILABLE_MESSAGE = "Este serviço não está disponível para reserva online no momento.";

export const SOME_SERVICES_UNAVAILABLE_MESSAGE = "Alguns serviços não estão disponíveis para reserva online no momento.";

export const POLICY_CHANGED_MESSAGE = "As regras do sinal mudaram. Confira antes de gerar o Pix.";

export const POLICY_MISSING_MESSAGE = "Não conseguimos carregar as regras do sinal. Tente de novo.";

export const SLOT_TAKEN_MESSAGE = "Esse horário acabou de ser reservado. Escolha outro.";

export const GENERIC_SUBMIT_MESSAGE = SUBMIT_RETRY_COPY;

export const OFFLINE_MESSAGE = "Sem conexão. Verifique sua internet e tente de novo.";

export const SLOTS_LOAD_MESSAGE = SLOTS_LOAD_COPY;

export function businessLoadCopy(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return BUSINESS_SLOW_COPY;
  if (isOfflineError(error)) return OFFLINE_MESSAGE;
  if (error instanceof Error && error.name === "PublicLoadError" && error.message === "not_found") {
    return BUSINESS_NOT_FOUND_COPY;
  }
  return BUSINESS_LOAD_COPY;
}

export type BookingFailure =
  | { kind: "paused" }
  | { kind: "policy_changed"; update: PolicyChangedUpdate }
  | { kind: "unavailable"; message: string; contactWhatsapp: string | null }
  | { kind: "slot_unavailable"; message: string }
  | { kind: "pix_create_failed"; retrySameKey: boolean | null }
  | { kind: "message"; message: string };

/** Falha de rede do `fetch` (TypeError ou mensagem de conexão). */
export function isOfflineError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof Error && /failed to fetch|networkerror|load failed|sem conexão/i.test(error.message);
}

export function readApiErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

function readContactWhatsapp(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const error = root.error && typeof root.error === "object" ? (root.error as Record<string, unknown>) : null;
  const value = error?.contactWhatsapp ?? root.contactWhatsapp;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Serviço com sinal que a disponibilidade marcou como não reservável. Sem sinal, o campo é ignorado. */
export function depositServiceUnbookable(depositCents: number, bookable: boolean | null | undefined): boolean {
  return depositCents > 0 && bookable === false;
}

function readBookableFalse(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const root = body as Record<string, unknown>;
  if (root.bookable === false) return true;
  const error = root.error;
  if (!error || typeof error !== "object") return false;
  const err = error as Record<string, unknown>;
  if (err.bookable === false) return true;
  const service = err.service;
  return Boolean(service && typeof service === "object" && (service as { bookable?: unknown }).bookable === false);
}

function readApiErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function readBooleanFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Contrato: `error.details.retry_same_key`. Os outros caminhos ficam só se esse não vier booleano. */
function readRetrySameKey(body: unknown): boolean | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const error = root.error && typeof root.error === "object" ? (root.error as Record<string, unknown>) : null;
  const details = error?.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : null;
  const fromDetails = readBooleanFlag(details?.retry_same_key);
  if (fromDetails !== null) return fromDetails;
  const fromError = readBooleanFlag(error?.retry_same_key);
  if (fromError !== null) return fromError;
  return readBooleanFlag(root.retry_same_key);
}

/**
 * Cobrança Pix que o gateway não criou. O `message` do servidor não entra na tela.
 * Sem `retry_same_key`, a primeira falha da visita mantém a Idempotency-Key (timeout ainda retoma).
 * Da segunda `payment_unavailable` seguida em diante, a próxima tentativa usa chave nova.
 * `retry_same_key: true` mantém; `false` troca já.
 */
export function pixCreateFailure(body: unknown): { retrySameKey: boolean | null } | null {
  if (readApiErrorCode(body) !== "payment_unavailable") return null;
  return { retrySameKey: readRetrySameKey(body) };
}

export function shouldRotatePixIdempotencyKey(retrySameKey: boolean | null, consecutiveFailures: number): boolean {
  if (retrySameKey === true) return false;
  if (retrySameKey === false) return true;
  return consecutiveFailures >= 2;
}

export function isPixCreateFailureBody(body: unknown): boolean {
  return pixCreateFailure(body) !== null;
}

/** Link `wa.me` a partir de um telefone publicado. Sem número útil, devolve null. */
export function whatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

/**
 * Erros públicos `{ error: { code, ... } }`.
 * Códigos conhecidos usam a copy da spec e ignoram o texto cru do servidor.
 */
export function publicBookingErrorView(status: number, body: unknown): BookingFailure {
  const code = readApiErrorCode(body);
  if (code === "bookings_paused") return { kind: "paused" };
  if (code === "policy_changed") {
    const update: PolicyChangedUpdate = readPolicyChangedUpdate(body) ?? {
      policySummary: null,
      policyHash: null,
      depositPolicy: null,
      policyDetails: null,
    };
    return { kind: "policy_changed", update };
  }
  if (code === "mp_account_not_connected" || code === "mp_consent_outdated" || code === "mp_account_test_mode" || readBookableFalse(body)) {
    return { kind: "unavailable", message: SERVICE_UNAVAILABLE_MESSAGE, contactWhatsapp: readContactWhatsapp(body) };
  }
  if (status === 409 && code === "slot_unavailable") {
    return { kind: "slot_unavailable", message: SLOT_TAKEN_MESSAGE };
  }
  const pixFailure = pixCreateFailure(body);
  if (pixFailure) return { kind: "pix_create_failed", retrySameKey: pixFailure.retrySameKey };
  const serverMessage = readApiErrorMessage(body);
  if (serverMessage) return { kind: "message", message: serverMessage };
  return { kind: "message", message: GENERIC_SUBMIT_MESSAGE };
}
