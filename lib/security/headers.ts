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
 * - style-src `'unsafe-inline'` — Sonner injects a `<style>` tag at runtime and
 *   has no nonce hook. A nonce in style-src would make browsers ignore
 *   `'unsafe-inline'` and block that tag (style-src-elem). Next's own CSS is a
 *   same-origin file (`'self'`). Script nonces stay strict.
 * - style-src-attr `'unsafe-inline'` — Sonner and Radix set style attributes.
 * - script-src `'unsafe-eval'` in development — React uses eval for debug stacks.
 * - `upgrade-insecure-requests` only off localhost, so `next dev` / `next start`
 *   on http://127.0.0.1 keep working. Production hostnames always send it.
 *
 * Fonts are self-hosted by `next/font` (`font-src 'self'`). No Google Fonts or
 * analytics origin is allowlisted.
 */

export type SecurityHeader = { key: string; value: string };

export const REFERRER_POLICY = "strict-origin-when-cross-origin";

export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

export type ContentSecurityPolicyOptions = {
  nonce: string;
  isDev: boolean;
  /** When false, omit upgrade-insecure-requests (local http). */
  upgradeInsecureRequests: boolean;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return LOCAL_HOSTS.has(normalized);
}

export function shouldUpgradeInsecureRequests(hostname: string, isDev: boolean): boolean {
  return !isDev && !isLocalHostname(hostname);
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
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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

export function documentSecurityHeaders(options: ContentSecurityPolicyOptions): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    ...baselineSecurityHeaders(),
  ];
}

/** Direct visits to files the proxy skips. Not applied to HTML documents. */
export function staticAssetSecurityHeaders(): SecurityHeader[] {
  return [
    ...baselineSecurityHeaders(),
    { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
  ];
}

export const STATIC_ASSET_HEADER_SOURCES = ["/_next/static/:path*", "/_next/image/:path*", "/favicon.ico"] as const;
