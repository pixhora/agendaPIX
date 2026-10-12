import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { appPreflight, requireAppOrigin, trustedAppOrigins, withAppCors } from "../../lib/origins";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-test-secret-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());

it("allows credentialed preflight for exact localhost:3000", async () => {
  const origin = "http://localhost:3000";
  const response = await appPreflight(new Request("http://localhost:3000/api/pix", { method: "OPTIONS", headers: {
    origin, "access-control-request-method": "PUT", "access-control-request-headers": "Content-Type, Authorization",
  } }), ["GET", "PUT", "DELETE"]);
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe(origin);
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  expect(response.headers.get("access-control-allow-methods")).toBe("GET, PUT, DELETE");
  expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization, Idempotency-Key");
  expect(response.headers.get("vary")).toContain("Origin");
});

it("aceita Origin null somente com Sec-Fetch-Site same-origin", async () => {
  const run = vi.fn(async () => Response.json({ ok: true }));
  const response = await withAppCors(new Request("http://localhost:3000/api/public/salao/bookings", {
    method: "POST",
    headers: { origin: "null", "Sec-Fetch-Site": "same-origin" },
  }), run);
  expect(response.status).toBe(200);
  expect(run).toHaveBeenCalledOnce();
  expect(response.headers.get("access-control-allow-origin")).toBe("null");
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
});

it.each([undefined, "cross-site", "same-site", "none"] as const)("recusa Origin null fora de same-origin (%s)", async (site) => {
  const headers = new Headers({ origin: "null" });
  if (site) headers.set("sec-fetch-site", site);
  const run = vi.fn();
  const response = await withAppCors(new Request("http://localhost:3000/api/public/salao/bookings", { method: "POST", headers }), run);
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "origin_not_allowed", message: "Origem da solicitação não permitida." } });
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  expect(run).not.toHaveBeenCalled();
});

it("origem fora da lista continua falhando, mesmo com Sec-Fetch-Site same-origin", async () => {
  const run = vi.fn();
  const response = await withAppCors(new Request("http://localhost:3000/api/public/salao/bookings", {
    method: "POST",
    headers: { origin: "https://evil.example", "Sec-Fetch-Site": "same-origin" },
  }), run);
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
  expect(run).not.toHaveBeenCalled();
});

it.each(["http://untrusted.example", "http://localhost:3000.evil.example", "http://127.0.0.1:3000", "null", "http://localhost:3000/path", "http://localhost:3000/", "http://LOCALHOST:3000", "http://localhost:3001", "http://localhost:3005", "http://localhost:3343"])("rejects origin %s before running the handler", async (origin) => {
  const run = vi.fn();
  const response = await withAppCors(new Request("http://localhost:3000/api/auth", { headers: { origin } }), run);
  expect(response.status).toBe(403);
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  expect(run).not.toHaveBeenCalled();
});

it("keeps cookies/status and CORS on error responses; accepts server-side GET without Origin", async () => {
  const headers = new Headers();
  headers.append("set-cookie", "one=synthetic; HttpOnly; SameSite=Lax");
  headers.append("set-cookie", "two=synthetic; HttpOnly; SameSite=Lax");
  const request = new Request("http://localhost:3000/api/auth", { headers: { origin: "http://localhost:3000" } });
  const response = await withAppCors(request, async () => new Response(null, { status: 401, headers }));
  expect(response.status).toBe(401);
  expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
  expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  const serverResponse = await withAppCors(new Request(request.url), async () => Response.json(null));
  expect(serverResponse.status).toBe(200);
  expect(serverResponse.headers.has("access-control-allow-origin")).toBe(false);
  expect(() => requireAppOrigin(new Request(request.url))).toThrow();
});

it.each([
  { "access-control-request-method": "PATCH", "access-control-request-headers": "" },
  { "access-control-request-method": "PUT", "access-control-request-headers": "x-untrusted" },
])("rejects unsupported preflight", async (extra) => {
  const request = new Request("http://localhost:3000/api/pix", { method: "OPTIONS", headers: { origin: "http://localhost:3000", ...extra } });
  expect((await appPreflight(request, ["GET", "PUT", "DELETE"])).status).toBe(403);
});

it("uses the canonical app origin and its www pair in production and rejects other origins before writes", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BETTER_AUTH_URL", "https://agenda.example/auth");
  expect(trustedAppOrigins()).toEqual(["https://agenda.example", "https://www.agenda.example"]);
  const run = vi.fn(async () => Response.json({ ok: true }));
  for (const origin of ["http://localhost:3000", "http://localhost:3001", "http://localhost:3005", "http://localhost:3343", "https://other.example", "https://agenda.example.evil.example"]) {
    const response = await withAppCors(new Request("https://agenda.example/api/onboarding", { method: "POST", headers: { origin } }), run);
    expect(response.status).toBe(403);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  }
  expect(run).not.toHaveBeenCalled();
  const response = await withAppCors(new Request("https://agenda.example/api/onboarding", { method: "POST", headers: { origin: "https://agenda.example" } }), run);
  expect(response.status).toBe(200);
  expect(response.headers.get("access-control-allow-origin")).toBe("https://agenda.example");
  expect(run).toHaveBeenCalledOnce();
});

it("returns safe unavailable response on invalid server configuration", async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "invalid");
  const response = await appPreflight(new Request("http://localhost:3000/api/auth", { headers: { origin: "http://localhost:3000" } }), ["POST"]);
  expect(response.status).toBe(503);
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
});
