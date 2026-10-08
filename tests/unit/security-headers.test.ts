import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
  STATIC_ASSET_HEADER_SOURCES,
  buildContentSecurityPolicy,
  documentSecurityHeaders,
  staticAssetSecurityHeaders,
} from "../../lib/security/headers";
import { proxy } from "../../proxy";

const NONCE = Buffer.from("11111111-1111-4111-8111-111111111111").toString("base64");

function headerMap(headers: { key: string; value: string }[]) {
  return new Map(headers.map((header) => [header.key.toLowerCase(), header.value]));
}

describe("document security headers", () => {
  it("sends CSP, frame, referrer, permissions and nosniff", () => {
    const headers = headerMap(documentSecurityHeaders({ nonce: NONCE, isDev: false, upgradeInsecureRequests: true }));
    const csp = headers.get("content-security-policy") ?? "";
    expect(csp).toContain(`'nonce-${NONCE}'`);
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/style-src [^;]*'nonce-/);
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    const parsedScriptSrc = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src"));
    expect(parsedScriptSrc?.startsWith("script-src ")).toBe(true);
    expect(parsedScriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(csp).not.toMatch(/google|analytics|umami|plausible|fonts\.gstatic|fonts\.googleapis/i);
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe(REFERRER_POLICY);
    expect(headers.get("permissions-policy")).toBe(PERMISSIONS_POLICY);
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) {
      expect(headers.get("permissions-policy")).toContain(feature);
    }
  });

  it("allows self-hosted fonts, same-origin fetches and Pix QR data images", () => {
    const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev: false, upgradeInsecureRequests: false });
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("img-src 'self' blob: data:");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev: true, upgradeInsecureRequests: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("rejects a nonce that could break the policy", () => {
    expect(() => buildContentSecurityPolicy({ nonce: "bad nonce", isDev: false, upgradeInsecureRequests: false })).toThrow(/base64/);
  });
});

describe("static asset headers", () => {
  it("covers files the proxy skips and still sends the security headers", () => {
    expect(STATIC_ASSET_HEADER_SOURCES).toEqual(["/_next/static/:path*", "/_next/image/:path*", "/favicon.ico"]);
    const headers = headerMap(staticAssetSecurityHeaders());
    expect(headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe(REFERRER_POLICY);
    expect(headers.get("permissions-policy")).toContain("camera=()");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("security proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets the headers on the response and does not leak the nonce header", () => {
    const response = proxy(new NextRequest("https://agenda.example/dashboard"));
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe(REFERRER_POLICY);
    expect(response.headers.get("permissions-policy")).toContain("microphone=()");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-nonce")).toBeNull();
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toContain(`'nonce-${nonce}'`);
  });

  it("uses a fresh nonce per request and skips upgrade on localhost", () => {
    const first = proxy(new NextRequest("http://127.0.0.1:3000/"));
    const second = proxy(new NextRequest("http://127.0.0.1:3000/api/health"));
    expect(first.headers.get("content-security-policy")).not.toBe(second.headers.get("content-security-policy"));
    expect(first.headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
    expect(second.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows eval only while developing", () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = proxy(new NextRequest("http://localhost:3000/preview/booking"));
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
