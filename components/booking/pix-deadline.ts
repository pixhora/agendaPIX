/**
 * Marcos em que o leitor de tela é avisado (perto do fim, quase no fim, expirado).
 * A validade do Pix não mora aqui: vem só do `expiresAt` enviado pelo servidor.
 */
export const PIX_DEADLINE_FIVE_MS = 5 * 60 * 1000;
export const PIX_DEADLINE_ONE_MS = 60 * 1000;

export type PixDeadlineMilestone = "five" | "one" | "expired";

export function parseServerDeadline(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Prefere o vencimento do pagamento; cai para o da reserva. Os dois vêm do servidor. */
export function paymentDeadlineIso(input: {
  expiresAt?: string | null;
  payment?: { expiresAt?: string | null } | null;
}): string | null {
  const fromPayment = input.payment?.expiresAt;
  if (typeof fromPayment === "string" && parseServerDeadline(fromPayment) != null) return fromPayment;
  const fromBooking = input.expiresAt;
  if (typeof fromBooking === "string" && parseServerDeadline(fromBooking) != null) return fromBooking;
  return null;
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function isDeadlineClose(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs <= PIX_DEADLINE_FIVE_MS;
}

export function nextDeadlineAnnouncement(
  remainingMs: number,
  announced: ReadonlySet<PixDeadlineMilestone>,
  payUntilLabel: string,
): { milestone: PixDeadlineMilestone; message: string } | null {
  if (remainingMs <= 0) {
    if (announced.has("expired")) return null;
    return { milestone: "expired", message: "O prazo para pagar o sinal acabou." };
  }
  if (remainingMs <= PIX_DEADLINE_ONE_MS) {
    if (announced.has("one") || announced.has("expired")) return null;
    return {
      milestone: "one",
      message: `Falta pouco tempo para pagar o sinal. Pague até ${payUntilLabel}.`,
    };
  }
  if (remainingMs <= PIX_DEADLINE_FIVE_MS) {
    if (announced.has("five") || announced.has("one") || announced.has("expired")) return null;
    return {
      milestone: "five",
      message: `O prazo para pagar está acabando. Pague até ${payUntilLabel}.`,
    };
  }
  return null;
}
