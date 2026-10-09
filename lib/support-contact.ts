import { z } from "zod";

/**
 * Número só com zero, DDI 55 seguido de zeros, ou um único dígito repetido.
 * Um celular real, com dígitos variados, passa.
 */
export function isPlaceholderWhatsappNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0 || /^(\d)\1+$/.test(digits)) return true;
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 0 || /^0+$/.test(national) || /^(\d)\1+$/.test(national);
}

/** E.164 sem "+": 8 a 15 dígitos, sem zero à esquerda e sem número de exemplo. A mesma regra do checkout manual. */
export const supportWhatsappNumberSchema = z
  .string()
  .regex(/^[1-9][0-9]{7,14}$/)
  .refine((value) => !isPlaceholderWhatsappNumber(value));

const PLACEHOLDER_EMAIL_DOMAINS = new Set(["example.com", "exemplo.com", "test.com", "email.com"]);

/** E-mail vazio, de domínio de exemplo, ou com parte local genérica. */
export function isPlaceholderEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return true;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (PLACEHOLDER_EMAIL_DOMAINS.has(domain) || domain.endsWith(".example") || domain.endsWith(".invalid")) return true;
  return /^(test|teste|exemplo|example|placeholder|email|foo|bar)$/.test(local) || /^0+$/.test(local) || /^x+$/.test(local);
}

export const supportEmailSchema = z.string().trim().toLowerCase().email().refine((value) => !isPlaceholderEmail(value));

/**
 * Só o link "Fale com a gente" quando SUPPORT_WHATSAPP_NUMBER falta ou é inválido.
 * O checkout da assinatura não usa este padrão: sem a env ele fica indisponível.
 */
const SUPPORT_WHATSAPP_FALLBACK = "5514997504655";

/** E-mail de apoio quando SUPPORT_EMAIL falta ou é inválido. O checkout não usa este padrão. */
const SUPPORT_EMAIL_FALLBACK = "francatorresmatheus@gmail.com";

type Env = Readonly<Record<string, string | undefined>>;

/** Número válido da env, ou null. Não aplica o padrão do link público. */
export function readSupportWhatsappNumber(env: Env = process.env): string | null {
  const parsed = supportWhatsappNumberSchema.safeParse(env.SUPPORT_WHATSAPP_NUMBER);
  return parsed.success ? parsed.data : null;
}

/** Link wa.me do "Fale com a gente". Usa a env e, se ela faltar, o número de apoio. */
export function supportWhatsappUrl(env: Env = process.env): string {
  return `https://wa.me/${readSupportWhatsappNumber(env) ?? SUPPORT_WHATSAPP_FALLBACK}`;
}

/** E-mail válido da env, ou null. Não aplica o padrão do link público. */
export function readSupportEmail(env: Env = process.env): string | null {
  const parsed = supportEmailSchema.safeParse(env.SUPPORT_EMAIL);
  return parsed.success ? parsed.data : null;
}

/** E-mail do rodapé e da FAQ. Usa a env e, se ela faltar, o e-mail de apoio. */
export function supportEmailAddress(env: Env = process.env): string {
  return readSupportEmail(env) ?? SUPPORT_EMAIL_FALLBACK;
}

export function supportMailtoUrl(env: Env = process.env): string {
  return `mailto:${supportEmailAddress(env)}`;
}
