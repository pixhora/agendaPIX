import { FAKE_BLOB_HOST, VERCEL_BLOB_PUBLIC_SUFFIX } from "../contracts/business-profile";

/**
 * Response security headers.
 *
 * Scripts use a per-request nonce (Next.js 16 proxy). Next reads the CSP on the
 * forwarded request and stamps that nonce on framework scripts. The theme
 * bootstrap in app/layout.tsx sets the same nonce explicitly. There is no
 * analytics script in the app; a future Umami/Plausible tag needs its origin
 * allowlisted and the request nonce on the tag.
 *
 * Allowed exceptions:
 * - img-src `data:` and `blob:` — Pix QR codes are `data:image/png;base64`
 *   (generated server-side). `blob:` covers Next image previews.
 * - img-src `https://*.public.blob.vercel-storage.com` — logo pública gravada
 *   com `put({ access: "public" })`. Em desenvolvimento também entra o host
 *   do adaptador falso (`blob.fake.local`). Produção não inclui esse host.
 * - style-src `'unsafe-inline'` — Sonner injects a `<style>` tag at runtime and
 *   has no nonce hook. A nonce in style-src would make browsers ignore
 *   `'unsafe-inline'` and block that tag (style-src-elem). Next's own CSS is a
 *   same-origin file (`'self'`). Script nonces stay strict.
 * - style-src-attr `'unsafe-inline'` — Sonner and Radix set style attributes.
 * - script-src `'unsafe-eval'` in development — React uses eval for debug stacks.
 * - form-action is `'self'` plus the Mercado Pago OAuth hosts and the WhatsApp
 *   hosts a form POST is redirected to. CSP Level 3 runs the form-action
 *   pre-navigation check on the request URL, and Fetch runs that check on each
 *   redirect (https://www.w3.org/TR/CSP3/#directive-form-action,
 *   https://www.w3.org/TR/CSP3/#integration-with-fetch). Chrome enforces the
 *   redirect; Firefox may not
 *   (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action).
 *   `wa.me` answers 302 to
 *   `https://api.whatsapp.com`, so both origins are listed. No wildcards.
 * - `upgrade-insecure-requests` and `Strict-Transport-Security` only off localhost
 *   and never in development, so `next dev` / `next start` on http://127.0.0.1
 *   keep working. Production hostnames always send both.
 * - HSTS is `max-age=63072000` with no `includeSubDomains` or `preload`.
 *   Vercel already sends that value on custom domains
 *   (https://vercel.com/docs/cdn-security/encryption). The stronger pair would
 *   pin every subdomain to HTTPS for two years and can break an HTTP sibling
 *   (mail, staging, Coolify). `*.vercel.app` already sends the stronger header
 *   and is preloaded by the platform.
 *
 * Fonts are self-hosted by `next/font` (`font-src 'self'`). No Google Fonts or
 * analytics origin is allowlisted.
 */

export type SecurityHeader = { key: string; value: string };

export const REFERRER_POLICY = "strict-origin-when-cross-origin";

/**
 * Two years, the value Vercel already sets on custom domains.
 * No `includeSubDomains` and no `preload`: those apply to every subdomain and
 * preload is hard to undo. See vercel.com/docs/cdn-security/encryption.
 */
export const HSTS_VALUE = "max-age=63072000";

/** Host patterns for next.config `missing` (Next anchors the regex itself). */
export const LOCAL_HOST_HEADER_PATTERNS = ["localhost", "127\\.0\\.0\\.1", "::1"] as const;

export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

export const BLOB_IMG_SRC = `https://*${VERCEL_BLOB_PUBLIC_SUFFIX}`;

export type ContentSecurityPolicyOptions = {
  nonce: string;
  isDev: boolean;
  /** When false, omit upgrade-insecure-requests (local http). */
  upgradeInsecureRequests: boolean;
};

export type DocumentSecurityHeaderOptions = ContentSecurityPolicyOptions & {
  /** Production hosts other than localhost, 127.0.0.1 and ::1. */
  strictTransportSecurity: boolean;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Destinations a document may navigate to after a form POST, including 303/302
 * targets. Chrome applies `form-action` to those redirects (MDN); CSP3 checks
 * each redirect in Fetch (https://www.w3.org/TR/CSP3/#integration-with-fetch).
 * `https://wa.me` is required because checkout answers 303 there, and
 * `https://api.whatsapp.com` because wa.me itself answers 302 to that host.
 */
export const FORM_ACTION_SOURCES = [
  "'self'",
  "https://auth.mercadopago.com",
  "https://auth.mercadopago.com.br",
  "https://wa.me",
  "https://api.whatsapp.com",
] as const;

/** https origin of `MP_OAUTH_AUTHORIZE_URL`, or null when it is missing or not a plain https URL. */
export function oauthAuthorizeOrigin(authorizeUrl: string | undefined): string | null {
  if (!authorizeUrl || authorizeUrl.includes("*")) return null;
  let url: URL;
  try {
    url = new URL(authorizeUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (!url.hostname || url.hostname.includes("*")) return null;
  return url.origin;
}

export function formActionSources(authorizeUrl = process.env.MP_OAUTH_AUTHORIZE_URL): string[] {
  const sources: string[] = [...FORM_ACTION_SOURCES];
  const extra = oauthAuthorizeOrigin(authorizeUrl);
  if (extra && !sources.includes(extra)) sources.push(extra);
  return sources;
}

export function formActionDirective(authorizeUrl = process.env.MP_OAUTH_AUTHORIZE_URL): string {
  return `form-action ${formActionSources(authorizeUrl).join(" ")}`;
}

export function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return LOCAL_HOSTS.has(normalized);
}

export function shouldUpgradeInsecureRequests(hostname: string, isDev: boolean): boolean {
  return !isDev && !isLocalHostname(hostname);
}

export function shouldSendStrictTransportSecurity(hostname: string, isDev: boolean): boolean {
  return shouldUpgradeInsecureRequests(hostname, isDev);
}

export function buildContentSecurityPolicy({ nonce, isDev, upgradeInsecureRequests }: ContentSecurityPolicyOptions): string {
  if (!/^[A-Za-z0-9+/=]+$/.test(nonce)) {
    throw new Error("CSP nonce must be base64.");
  }

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  // No nonce here: it would disable 'unsafe-inline' and block Sonner's runtime <style>.
  const styleSrc = "'self' 'unsafe-inline'";

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleSrc}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data: ${BLOB_IMG_SRC}${isDev ? ` https://${FAKE_BLOB_HOST}` : ""}`,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    formActionDirective(),
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
  ];
  if (upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function baselineSecurityHeaders(): SecurityHeader[] {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: REFERRER_POLICY },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "X-Content-Type-Options", value: "nosniff" },
  ];
}

export function documentSecurityHeaders(options: DocumentSecurityHeaderOptions): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    ...baselineSecurityHeaders(),
  ];
  if (options.strictTransportSecurity) {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }
  return headers;
}

export type StaticAssetHeaderRule = {
  source: string;
  headers: SecurityHeader[];
  missing?: { type: "host"; value: string }[];
};

/** Security headers for files the proxy skips. HSTS only in production, and not for local hosts. */
export function staticAssetHeaderRules(isDev: boolean): StaticAssetHeaderRule[] {
  const base = staticAssetSecurityHeaders();
  const rules: StaticAssetHeaderRule[] = STATIC_ASSET_HEADER_SOURCES.map((source) => ({ source, headers: base }));
  if (isDev) return rules;
  const hsts: SecurityHeader[] = [{ key: "Strict-Transport-Security", value: HSTS_VALUE }];
  for (const source of STATIC_ASSET_HEADER_SOURCES) {
    rules.push({
      source,
      missing: LOCAL_HOST_HEADER_PATTERNS.map((value) => ({ type: "host", value })),
      headers: hsts,
    });
  }
  return rules;
}

/** Direct visits to files the proxy skips. Not applied to HTML documents. */
export function staticAssetSecurityHeaders(): SecurityHeader[] {
  return [
    ...baselineSecurityHeaders(),
    { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
  ];
}

export const STATIC_ASSET_HEADER_SOURCES = ["/_next/static/:path*", "/_next/image/:path*", "/favicon.ico"] as const;
