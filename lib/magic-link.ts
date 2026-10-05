import { DEFAULT_AFTER_LOGIN, loginErrorPath } from "./safe-redirect";

export type MagicLinkResult =
  | { ok: true; simulated?: boolean }
  | { ok: false; code: "auth_unavailable" | "invalid_email" | "unknown"; message: string };

/** Rota real do Better Auth neste mesmo app (`app/api/auth/[...all]`). */
export const MAGIC_LINK_ENDPOINT = "/api/auth/sign-in/magic-link";

/**
 * Solicita o link mágico de acesso à rota de auth do próprio app (same-origin).
 *
 * Regra de segurança: falhas de infraestrutura (5xx) ou de rede NUNCA fingem sucesso
 * em rotas reais (/login, /onboarding). Apenas páginas sob /preview podem simular
 * o envio para fins visuais.
 */
export async function requestMagicLink(
  email: string,
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  callbackURL = DEFAULT_AFTER_LOGIN,
  errorCallbackURL = loginErrorPath(callbackURL),
): Promise<MagicLinkResult> {
  const isPreview = pathname.startsWith("/preview");

  try {
    const res = await fetch(MAGIC_LINK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: email.trim().toLowerCase(), callbackURL, errorCallbackURL }),
    });

    if (res.ok) return { ok: true };

    if (res.status >= 500) {
      if (isPreview) return { ok: true, simulated: true };
      return {
        ok: false,
        code: "auth_unavailable",
        message: "O serviço de envio de e-mail está temporariamente indisponível. Tente novamente em alguns instantes.",
      };
    }

    const body = await res.json().catch(() => null);
    return {
      ok: false,
      code: "invalid_email",
      message: (typeof body?.message === "string" && body.message) || "Não foi possível enviar o link de acesso. Verifique o e-mail informado.",
    };
  } catch {
    if (isPreview) return { ok: true, simulated: true };
    return { ok: false, code: "unknown", message: "Sem conexão com o servidor. Verifique sua internet e tente novamente." };
  }
}
