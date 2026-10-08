import { z } from "zod";

export const CONTACT_WHATSAPP_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export function normalizeContactWhatsapp(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!compact) return null;
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("55")) return `+${compact}`;
  return `+55${compact}`;
}

export const contactWhatsappSchema = z
  .string()
  .trim()
  .transform(normalizeContactWhatsapp)
  .refine((value) => value === null || CONTACT_WHATSAPP_PATTERN.test(value), "Informe o WhatsApp com DDD. Exemplo: +5511999999999.");
