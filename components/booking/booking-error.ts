import { readPolicyChangedUpdate } from "./policy-gate";
import type { PolicyChangedUpdate } from "./types";

export const SERVICE_UNAVAILABLE_MESSAGE = "Este serviço não está disponível para reserva online no momento.";

export const SOME_SERVICES_UNAVAILABLE_MESSAGE = "Alguns serviços não estão disponíveis para reserva online no momento.";

export const POLICY_CHANGED_MESSAGE = "As regras do sinal mudaram. Confira antes de gerar o Pix.";

export const POLICY_MISSING_MESSAGE = "Não conseguimos carregar as regras do sinal. Tente de novo.";

export type BookingFailure =
  | { kind: "paused" }
  | { kind: "policy_changed"; update: PolicyChangedUpdate }
  | { kind: "unavailable"; message: string; contactWhatsapp: string | null }
  | { kind: "message"; message: string };

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
  if (code === "mp_account_not_connected" || code === "mp_account_test_mode" || readBookableFalse(body)) {
    return { kind: "unavailable", message: SERVICE_UNAVAILABLE_MESSAGE, contactWhatsapp: readContactWhatsapp(body) };
  }
  const serverMessage = readApiErrorMessage(body);
  if (serverMessage) return { kind: "message", message: serverMessage };
  if (status === 409) {
    return { kind: "message", message: "Esse horário acabou de ser reservado por outra pessoa. Por favor, escolha outro horário." };
  }
  return { kind: "message", message: "Não foi possível criar o agendamento. Tente novamente." };
}
