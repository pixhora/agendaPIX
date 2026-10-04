export type MagicLinkResult =
  | { ok: true; simulated?: boolean }
  | { ok: false; code: "auth_unavailable" | "invalid_email" | "unknown"; message: string };

/**
 * Envia solicitação de link mágico de autenticação.
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
    const res = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
