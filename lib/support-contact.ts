import { z } from "zod";

/** E.164 sem "+": 8 a 15 dígitos, sem zero à esquerda. A mesma regra do checkout manual. */
export const supportWhatsappNumberSchema = z.string().regex(/^[1-9][0-9]{7,14}$/);

/**
 * Só o link "Fale com a gente" quando SUPPORT_WHATSAPP_NUMBER falta ou é inválido.
 * O checkout da assinatura não usa este padrão: sem a env ele fica indisponível.
 */
const SUPPORT_WHATSAPP_FALLBACK = "5514997504655";

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
