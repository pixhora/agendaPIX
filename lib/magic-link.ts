export type MagicLinkResult =
  | { ok: true; simulated?: boolean }
  | { ok: false; code: "auth_unavailable" | "invalid_email" | "unknown"; message: string };

export const BACKEND_AUTH_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  "http://localhost:3000";

/**
 * Envia solicitação de link mágico de autenticação consumindo a autoridade do backend (B-02).
 * 
 * Regra de segurança: falhas de infraestrutura (5xx) ou rede (catch)
 * NUNCA devem fingir sucesso nem simular envio em rotas reais (/login, /onboarding).
 * Apenas rotas explicitamente sob /preview podem simular feedback para fins visuais.
 */
export async function requestMagicLink(
  email: string,
  pathname = typeof window !== "undefined" ? window.location.pathname : ""
): Promise<MagicLinkResult> {
  const isPreview = pathname.startsWith("/preview");

  try {
    const res = await fetch(`${BACKEND_AUTH_URL}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        callbackURL: "/dashboard",
      }),
    });

    if (res.ok) return { ok: true };

    if (res.status >= 500) {
      if (isPreview) {
        return { ok: true, simulated: true };
      }
      return {
        ok: false,
        code: "auth_unavailable",
        message:
          "O serviço de envio de e-mail está temporariamente indisponível. Tente novamente em alguns instantes.",
      };
    }

    const body = await res.json().catch(() => null);
    return {
      ok: false,
      code: "invalid_email",
      message:
        (body?.message as string) ||
        "Não foi possível enviar o link de acesso. Verifique o e-mail informado.",
    };
  } catch {
    if (isPreview) {
      return { ok: true, simulated: true };
    }
    return {
      ok: false,
      code: "unknown",
      message: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    };
  }
}
