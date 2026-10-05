/** Destino padrão depois do login do dono. */
export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Aceita apenas caminhos relativos deste mesmo app como destino pós-login.
 * Rejeita URLs absolutas, protocol-relative (`//`), barras invertidas, caracteres de controle
 * e destinos que voltariam ao próprio login ou a rotas de API.
 */
export function safeNextPath(value: unknown, fallback = DEFAULT_AFTER_LOGIN): string {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  if (!candidate || candidate.length > 512) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(candidate, "http://agenda.invalid");
  } catch {
    return fallback;
  }
  if (parsed.origin !== "http://agenda.invalid") return fallback;
  const path = parsed.pathname;
  if (path === "/login" || path.startsWith("/login/") || path.startsWith("/dashboard/login") || path.startsWith("/api/")) {
    return fallback;
  }
  return `${path}${parsed.search}${parsed.hash}`;
}

/**
 * Para onde o Better Auth manda o usuário quando o link mágico é inválido ou expirou.
 * O Better Auth acrescenta `?error=CODIGO`; o `next` preserva o destino original.
 */
export function loginErrorPath(callbackURL: string): string {
  const next = safeNextPath(callbackURL);
  return next === DEFAULT_AFTER_LOGIN ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
