import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { cachedAliasTarget } from "@/lib/business-profile/alias-cache";
import { aliasTarget, locationForMovedSlug, publicSlugFromPath } from "@/lib/business-profile/public-slug";
import { documentSecurityHeaders, shouldSendStrictTransportSecurity, shouldUpgradeInsecureRequests } from "@/lib/security/headers";

type AliasLookup = (slug: string) => Promise<string | null>;

/** Next passa `event`. Teste pode passar a função de busca nesse lugar. */
function resolveAliasLookup(event: unknown): AliasLookup {
  return typeof event === "function" ? (event as AliasLookup) : aliasTarget;
}

function documentHeaders(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const headers = documentSecurityHeaders({
    nonce,
    isDev,
    upgradeInsecureRequests: shouldUpgradeInsecureRequests(request.nextUrl.hostname, isDev),
    strictTransportSecurity: shouldSendStrictTransportSecurity(request.nextUrl.hostname, isDev),
  });
  const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value;
  if (!csp) throw new Error("Missing Content-Security-Policy.");
  return { nonce, csp, headers };
}

/**
 * Per-request nonce CSP plus the other security headers.
 * An old public slug answers 308 before the page streams, including subpaths.
 * Skips Next prefetch so a nonce is not frozen into a cached payload, and
 * skips files covered by `headers()` in next.config.ts.
 */
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const lookup = resolveAliasLookup(event);
  const slug = publicSlugFromPath(request.nextUrl.pathname);
  if (slug) {
    try {
      const target = await cachedAliasTarget(slug, lookup);
      if (target && target !== slug) {
        const location = new URL(locationForMovedSlug(request.url, slug, target), request.url);
        const response = NextResponse.redirect(location, 308);
        const { headers } = documentHeaders(request);
        for (const header of headers) response.headers.set(header.key, header.value);
        response.headers.set("Cache-Control", "no-store");
        return response;
      }
    } catch {
      // A página e as rotas públicas repetem o 308 se o proxy não alcançar o banco.
    }
  }

  const { nonce, csp, headers } = documentHeaders(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const header of headers) response.headers.set(header.key, header.value);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
