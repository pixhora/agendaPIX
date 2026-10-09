import type { PaymentStatusResponse } from "./types";
import { pixUiPhase } from "./pix-status";

/** Aborta a consulta do Pix depois de ~8–10s. O gateway lento não segura o próximo ciclo. */
export const PAYMENT_CHECK_TIMEOUT_MS = 10_000;

/** Limite de tentativas manuais consecutivas sem confirmação (só reforça o aviso; o botão continua utilizável). */
export const PAYMENT_CHECK_MAX_MANUAL_ATTEMPTS = 8;

export const PAYMENT_PENDING_CONFIRMATION_MESSAGE =
  "Ainda não recebemos a confirmação do Pix. Pode levar alguns instantes.";

export const PAYMENT_CHECK_ERROR_MESSAGE =
  "Não foi possível verificar no momento. Tentaremos novamente.";

export const PAYMENT_CHECK_TIMEOUT_MESSAGE =
  "A verificação demorou demais. Tente novamente em alguns instantes.";

export type PaymentCheckOutcome =
  | { kind: "confirmed"; data: PaymentStatusResponse }
  | { kind: "expired"; data?: PaymentStatusResponse }
  | { kind: "pending"; data?: PaymentStatusResponse | null }
  | { kind: "error"; message: string };

export function interpretPaymentStatus(data: PaymentStatusResponse | null | undefined): PaymentCheckOutcome {
  if (!data) return { kind: "pending", data: data ?? null };
  const phase = pixUiPhase(data);
  if (phase === "paid") return { kind: "confirmed", data };
  if (phase === "expired") return { kind: "expired", data };
  return { kind: "pending", data };
}

/** Botão/rota de simulação só no checkout local com provedor fake (bloqueado em production). */
export function canShowDevSimulatePix(provider: string | null | undefined): boolean {
  return process.env.NODE_ENV === "development" && provider === "fake";
}

export function pendingMessageForAttempts(manualAttempts: number): string {
  if (manualAttempts >= PAYMENT_CHECK_MAX_MANUAL_ATTEMPTS) {
    return `${PAYMENT_PENDING_CONFIRMATION_MESSAGE} Se o problema continuar, atualize a página ou fale com o estabelecimento.`;
  }
  return PAYMENT_PENDING_CONFIRMATION_MESSAGE;
}

/** Envolve uma promise com o AbortSignal do timeout da verificação. */
export function withPaymentCheckTimeout<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
