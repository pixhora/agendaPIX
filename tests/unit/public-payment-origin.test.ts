import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OPTIONS as bookingOptions } from "../../app/api/public/[slug]/bookings/route";
import { OPTIONS as servicesOptions } from "../../app/api/public/[slug]/services/route";
import { OPTIONS as payOptions } from "../../app/api/public/[slug]/slot-links/[token]/pay/route";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-test-secret-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());

function preflight(url: string, site?: string) {
  const headers = new Headers({
    origin: "null",
    "access-control-request-method": "POST",
    "access-control-request-headers": "Content-Type, Idempotency-Key",
  });
  if (site) headers.set("sec-fetch-site", site);
  return new Request(url, { method: "OPTIONS", headers });
}

function expectNoCors(response: Response) {
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  expect(response.headers.has("access-control-allow-credentials")).toBe(false);
  expect(response.headers.get("access-control-allow-origin")).not.toBe("null");
}

it("OPTIONS da reserva pública aceita Origin null same-origin sem CORS", async () => {
  const response = await bookingOptions(preflight("http://localhost:3000/api/public/salao/bookings", "same-origin"));
  expect(response.status).toBe(204);
  expectNoCors(response);
  expect(response.headers.get("access-control-allow-methods")).toBe("POST");
});

it("OPTIONS do pagamento do link aceita Origin null same-origin sem CORS", async () => {
  const response = await payOptions(preflight("http://localhost:3000/api/public/salao/slot-links/token/pay", "same-origin"));
  expect(response.status).toBe(204);
  expectNoCors(response);
  expect(response.headers.get("access-control-allow-methods")).toBe("POST");
});

it("OPTIONS de outra rota pública recusa Origin null", async () => {
  const response = await servicesOptions(preflight("http://localhost:3000/api/public/salao/services", "same-origin"));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
  expectNoCors(response);
});

it("OPTIONS de pagamento recusa Origin null sem same-origin", async () => {
  const response = await bookingOptions(preflight("http://localhost:3000/api/public/salao/bookings", "cross-site"));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
  expectNoCors(response);
});
