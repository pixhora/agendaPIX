import { formatCurrency, formatDuration } from "./formatters";

export interface ServiceCardMoney {
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
}

/**
 * Linha de duração e preço do card.
 * Sem sinal, o preço fica nessa linha e o lado direito diz "Sem sinal".
 * Preço zero não vira "R$ 0,00".
 */
export function serviceCardMeta(service: ServiceCardMoney): string {
  const duration = formatDuration(service.durationMinutes);
  if (service.depositCents > 0 || service.priceCents <= 0) return duration;
  return `${duration} · ${formatCurrency(service.priceCents)}`;
}

/** Lado direito do card selecionável. Sem sinal, nunca o preço. */
export function serviceCardAside(service: ServiceCardMoney): string | null {
  if (service.depositCents <= 0) return "Sem sinal";
  if (service.priceCents <= 0) return null;
  return formatCurrency(service.priceCents);
}
