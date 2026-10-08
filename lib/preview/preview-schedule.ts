import { getMockAvailabilitySlots } from "@/lib/preview/mock-data";
import type { AvailabilitySlot } from "@/components/booking/types";

/** Janela do Pix no preview normal: agora + 30 min, sempre antes do horário de amanhã. */
export const PIX_HOLD_MS = 30 * 60 * 1000;

/** Cena "prazo acabando": ainda no futuro, dentro dos 5 min do aviso âmbar. */
export const PIX_CLOSE_MS = 4 * 60 * 1000;

export function dateInSaoPaulo(daysAhead: number, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000));
}

export function tomorrowInSaoPaulo(now = new Date()): string {
  return dateInSaoPaulo(1, now);
}

/** Primeiro horário livre daqui a `daysAhead` dias. O fluxo normal usa 3, para o prazo de 24 h ainda estar no futuro. */
export function previewOpeningSlot(now = new Date(), daysAhead = 3): AvailabilitySlot | null {
  return getMockAvailabilitySlots(dateInSaoPaulo(daysAhead, now))[0] ?? null;
}

/** Cena "em cima da hora": amanhã às 11:30, dentro da janela de 24 h no fim do dia. */
export function previewLateSlot(now = new Date()): AvailabilitySlot | null {
  return previewOpeningSlot(now, 1);
}

export function previewPayDeadline(scene: "pix" | "pix-perto" | "pix-expirado", now = new Date()): Date {
  const offset = scene === "pix-perto" ? PIX_CLOSE_MS : scene === "pix-expirado" ? -60 * 1000 : PIX_HOLD_MS;
  return new Date(now.getTime() + offset);
}
