import { depositUnavailable, showDepositUnavailableCard } from "@/lib/mercadopago/contract";

export { depositUnavailable, showDepositUnavailableCard };

export function whatsAppHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}
