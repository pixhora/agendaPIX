import { parseMoney } from "@/lib/dashboard/validation";

/** R$ 99.999,99. Extra digits are ignored. */
export const MAX_MONEY_CENTS = 9_999_999;

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function depositFromPercent(priceCents: number, percent: number): number {
  if (priceCents <= 0) return 0;
  return Math.round((priceCents * percent) / 100);
}

/** Digits typed into the field are cents, not reais. Leading zeros from "0,06" are ignored. */
export function centsFromTypedField(raw: string): { cents: number | null; overflow: boolean } {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return { cents: null, overflow: false };
  if (digits.length > 7 || Number(digits) > MAX_MONEY_CENTS) return { cents: null, overflow: true };
  const cents = Number(digits);
  return { cents: cents === 0 ? null : cents, overflow: false };
}

/**
 * Paste: "65,90", "65.9", "R$ 65,90", "1.234,56".
 * A dot followed by exactly 3 digits and then a comma is a thousands separator.
 * The rest follows `parseMoney` (no float multiplication).
 */
export function parsePastedMoney(raw: string): number | null {
  let text = raw.replace(/r\$/gi, "").replace(/\s+/g, "");
  if (!text) return null;
  if (/\.\d{3},/.test(text)) text = text.replace(/\./g, "");
  try {
    const cents = parseMoney(text);
    if (!Number.isInteger(cents) || cents > MAX_MONEY_CENTS) return null;
    return cents;
  } catch {
    return null;
  }
}

export function appendMoneyDigit(cents: number, digit: number): { cents: number; overflow: boolean } {
  if (digit < 0 || digit > 9 || !Number.isInteger(digit)) return { cents, overflow: false };
  const next = cents * 10 + digit;
  if (next > MAX_MONEY_CENTS) return { cents, overflow: true };
  return { cents: next, overflow: false };
}

export function backspaceMoney(cents: number): number {
  return Math.floor(cents / 10);
}
