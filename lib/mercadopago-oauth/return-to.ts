/** Destinos internos aceitos depois do OAuth. Qualquer outro valor cai no painel. */
export const MP_RETURN_PREFIXES = ["/dashboard", "/onboarding"] as const;
export const MP_RETURN_FALLBACK = "/dashboard";

export type MpCallbackReason = "access_denied" | "state_mismatch" | "expired_code" | "exchange_failed" | "already_linked_elsewhere" | "auto_refund_ack_required";

function allowedPath(pathname: string) {
  return MP_RETURN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Aceita só path interno em /dashboard ou /onboarding. Rejeita URL absoluta, protocol-relative e barras invertidas. */
export function sanitizeMpReturnTo(value: unknown, fallback = MP_RETURN_FALLBACK) {
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
  if (!allowedPath(parsed.pathname)) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function mpResultPath(returnTo: string, result: { mp: "connected" } | { mp: "error"; reason: MpCallbackReason }) {
  const url = new URL(sanitizeMpReturnTo(returnTo), "http://agenda.invalid");
  url.searchParams.set("mp", result.mp);
  if (result.mp === "error") url.searchParams.set("reason", result.reason);
  return `${url.pathname}${url.search}${url.hash}`;
}
