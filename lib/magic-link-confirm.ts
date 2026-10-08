import { safeNextPath } from "./safe-redirect";

const FORWARDED_QUERY = ["token", "callbackURL", "errorCallbackURL", "newUserCallbackURL"] as const;

/**
 * O plugin magicLink 1.7.7 só verifica em GET `/magic-link/verify`.
 * O e-mail aponta para esta página; o botão confirma em POST no servidor.
 */
export function buildLoginConfirmUrl(verifyUrl: string) {
  const source = new URL(verifyUrl);
  const target = new URL("/entrar/confirmar", source.origin);
  for (const key of FORWARDED_QUERY) {
    const value = source.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return target.toString();
}

/** Destino quando o link falha. Só `/login` deste app, com a query que o acesso acrescenta. */
export function loginErrorDestination(value: string | null | undefined) {
  if (typeof value !== "string") return "/login";
  const candidate = value.trim();
  if (!candidate || candidate.length > 512 || !candidate.startsWith("/") || candidate.startsWith("//")) return "/login";
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return "/login";
  let parsed: URL;
  try { parsed = new URL(candidate, "http://agenda.invalid"); }
  catch { return "/login"; }
  if (parsed.origin !== "http://agenda.invalid" || parsed.pathname !== "/login") return "/login";
  return `${parsed.pathname}${parsed.search}`;
}

export function confirmRedirectPath(location: string | null, fallback: string) {
  if (!location) return fallback;
  try {
    const url = new URL(location, "http://agenda.invalid");
    if (url.origin !== "http://agenda.invalid" && !location.startsWith("http")) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return loginErrorDestination(path);
    return safeNextPath(path, fallback);
  } catch {
    return fallback;
  }
}
