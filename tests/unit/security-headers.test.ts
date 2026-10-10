import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FORM_ACTION_SOURCES,
  HSTS_VALUE,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
  STATIC_ASSET_HEADER_SOURCES,
  buildContentSecurityPolicy,
  documentSecurityHeaders,
  formActionDirective,
  staticAssetHeaderRules,
  staticAssetSecurityHeaders,
} from "../../lib/security/headers";
import { proxy } from "../../proxy";

const fetchEvent = { waitUntil() {} } as unknown as NextFetchEvent;

const NONCE = Buffer.from("11111111-1111-4111-8111-111111111111").toString("base64");

function headerMap(headers: { key: string; value: string }[]) {
  return new Map(headers.map((header) => [header.key.toLowerCase(), header.value]));
}

describe("document security headers", () => {
  it("sends CSP, frame, referrer, permissions and nosniff", () => {
    const headers = headerMap(documentSecurityHeaders({ nonce: NONCE, isDev: false, upgradeInsecureRequests: true, strictTransportSecurity: true }));
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
    expect(headers.get("strict-transport-security")).toBe(HSTS_VALUE);
    expect(HSTS_VALUE).not.toMatch(/includeSubDomains|preload/i);
    for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) {
      expect(headers.get("permissions-policy")).toContain(feature);
    }
  });

  it("omits HSTS when the flag is off", () => {
    const headers = headerMap(documentSecurityHeaders({ nonce: NONCE, isDev: true, upgradeInsecureRequests: false, strictTransportSecurity: false }));
    expect(headers.has("strict-transport-security")).toBe(false);
  });

  it("allows self-hosted fonts, same-origin fetches and Pix QR data images", () => {
    const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev: false, upgradeInsecureRequests: false });
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("img-src 'self' blob: data: https://*.public.blob.vercel-storage.com");
    expect(csp).not.toContain("blob.fake.local");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev: true, upgradeInsecureRequests: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("https://blob.fake.local");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("rejects a nonce that could break the policy", () => {
    expect(() => buildContentSecurityPolicy({ nonce: "bad nonce", isDev: false, upgradeInsecureRequests: false })).toThrow(/base64/);
  });

  it("allows form redirects only to Mercado Pago and WhatsApp, plus a configured OAuth origin", () => {
    const base = `form-action ${FORM_ACTION_SOURCES.join(" ")}`;
    expect(FORM_ACTION_SOURCES).toEqual([
      "'self'",
      "https://auth.mercadopago.com",
      "https://auth.mercadopago.com.br",
      "https://wa.me",
      "https://api.whatsapp.com",
    ]);
    expect(formActionDirective("")).toBe(base);
    expect(base).not.toMatch(/\*/);
    expect(base.split(" ").filter((source) => source === "https:")).toEqual([]);
    expect(formActionDirective("https://auth.mercadopago.com/authorization?client_id=1")).toBe(base);
    expect(formActionDirective("https://auth.mercadopago.com.br/authorization")).toBe(base);
    expect(formActionDirective("https://oauth.example.test/authorize")).toBe(`${base} https://oauth.example.test`);
    expect(formActionDirective("https://oauth.example.test:8443/authorize")).toBe(`${base} https://oauth.example.test:8443`);
    expect(formActionDirective("http://oauth.example.test/authorize")).toBe(base);
    expect(formActionDirective("https://user:secret@oauth.example.test/authorize")).toBe(base);
    expect(formActionDirective("not a url")).toBe(base);
    expect(formActionDirective("https://*.example.test/authorize")).toBe(base);

    vi.stubEnv("MP_OAUTH_AUTHORIZE_URL", "https://pagos.example/oauth/authorize");
    try {
      const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev: false, upgradeInsecureRequests: false });
      expect(csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("form-action"))).toBe(`${base} https://pagos.example`);
    } finally {
      vi.unstubAllEnvs();
    }
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
    expect(headers.has("strict-transport-security")).toBe(false);
  });

  it("adds HSTS in production except on local hosts", () => {
    const devRules = staticAssetHeaderRules(true);
    expect(devRules.every((rule) => rule.headers.every((header) => header.key !== "Strict-Transport-Security"))).toBe(true);

    const prodRules = staticAssetHeaderRules(false);
    const hstsRules = prodRules.filter((rule) => rule.headers.some((header) => header.key === "Strict-Transport-Security"));
    expect(hstsRules).toHaveLength(STATIC_ASSET_HEADER_SOURCES.length);
    for (const rule of hstsRules) {
      expect(rule.headers).toEqual([{ key: "Strict-Transport-Security", value: HSTS_VALUE }]);
      expect(rule.missing?.map((item) => item.value)).toEqual(["localhost", "127\\.0\\.0\\.1", "::1"]);
    }
  });
});

describe("security proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets the headers on the response and does not leak the nonce header", async () => {
    const response = await proxy(new NextRequest("https://agenda.example/dashboard"), fetchEvent);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe(REFERRER_POLICY);
    expect(response.headers.get("permissions-policy")).toContain("microphone=()");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("strict-transport-security")).toBe(HSTS_VALUE);
    expect(response.headers.get("x-nonce")).toBeNull();
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toContain(`'nonce-${nonce}'`);
  });

  it("uses a fresh nonce per request and skips upgrade on localhost", async () => {
    const first = await proxy(new NextRequest("http://127.0.0.1:3000/"), fetchEvent);
    const second = await proxy(new NextRequest("http://127.0.0.1:3000/api/health"), fetchEvent);
    expect(first.headers.get("content-security-policy")).not.toBe(second.headers.get("content-security-policy"));
    expect(first.headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
    expect(first.headers.get("strict-transport-security")).toBeNull();
    expect(second.headers.get("strict-transport-security")).toBeNull();
    expect((await proxy(new NextRequest("http://[::1]:3000/api/health"), fetchEvent)).headers.get("strict-transport-security")).toBeNull();
    expect((await proxy(new NextRequest("http://agenda.example/api/health"), fetchEvent)).headers.get("strict-transport-security")).toBe(HSTS_VALUE);
    expect(second.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows eval only while developing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await proxy(new NextRequest("http://localhost:3000/preview/booking"), fetchEvent);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(response.headers.get("strict-transport-security")).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    expect((await proxy(new NextRequest("https://agenda.example/"), fetchEvent)).headers.get("strict-transport-security")).toBe(HSTS_VALUE);
  });
});
