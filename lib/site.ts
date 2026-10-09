const DEFAULT_SITE_ORIGIN = "https://www.agendapix.dev.br";

export const siteName = "AgendaPix";

export const siteTitle = "AgendaPix · Agenda online com sinal no Pix";

/** ≤ 155 caracteres. O teste grátis de 7 dias está decidido. */
export const siteDescription =
  "Seu cliente agenda pelo link e paga o sinal no Pix. A reserva confirma sozinha. Para barbearias, salões, manicures e estética. 7 dias grátis.";

/** H1 da landing (02 §3). Usado na imagem de compartilhamento. */
export const sitePromise = "Seu cliente agenda sozinho e já chega com o sinal pago.";

/**
 * Open Graph compartilhado. O nome é masculino ("o AgendaPix").
 * `openGraph` no Next substitui o objeto inteiro do layout pai: a home
 * espalha este objeto e acrescenta `url`.
 */
export const siteOpenGraph = {
  type: "website" as const,
  locale: "pt_BR",
  siteName,
  title: siteTitle,
  description: siteDescription,
};

/** Origem canônica. `NEXT_PUBLIC_SITE_URL` quando for http(s); senão o host final. */
export function siteOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return new URL(DEFAULT_SITE_ORIGIN);
  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") return new URL(DEFAULT_SITE_ORIGIN);
    return new URL(url.origin);
  } catch {
    return new URL(DEFAULT_SITE_ORIGIN);
  }
}

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** Host do mock, sem protocolo. Localhost cai no domínio canônico. */
export function publicSiteHost(): string {
  const origin = siteOrigin();
  if (localHosts.has(origin.hostname)) return new URL(DEFAULT_SITE_ORIGIN).host;
  return origin.host;
}
