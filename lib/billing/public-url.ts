import { authEnvSchema } from "../env";
import { publicBookingPagePath } from "../public-api";

type Env = Readonly<Record<string, string | undefined>>;

/** Origem pública do negócio: BETTER_AUTH_URL + caminho já codificado da página `/{slug}`. */
export function publicBusinessPageUrl(slug: string, env: Env = process.env) {
  const parsed = authEnvSchema.pick({ BETTER_AUTH_URL: true }).safeParse(env);
  if (!parsed.success) return null;
  const origin = new URL(parsed.data.BETTER_AUTH_URL).origin;
  return new URL(publicBookingPagePath(slug), origin).href;
}

export function subscriptionWhatsappText(publicUrl: string) {
  return `Quero assinar o AgendaPix. Meu link: ${publicUrl}`;
}

export function manualWhatsappUrl(whatsappNumber: string, publicUrl: string) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(subscriptionWhatsappText(publicUrl))}`;
}
