import { NextResponse, type NextRequest } from "next/server";
import { documentSecurityHeaders, shouldSendStrictTransportSecurity, shouldUpgradeInsecureRequests } from "@/lib/security/headers";

/**
 * Per-request nonce CSP plus the other security headers.
 * Skips Next prefetch so a nonce is not frozen into a cached payload, and
 * skips files covered by `headers()` in next.config.ts.
 */
export function proxy(request: NextRequest) {
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
