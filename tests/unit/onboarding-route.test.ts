import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), provision: vi.fn() }));
vi.mock("../../lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("../../lib/onboarding/service", () => ({ provisionBusiness: mocks.provision }));
import { POST, OPTIONS } from "../../app/api/onboarding/route";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-onboarding-secret-at-least-32-characters");
  mocks.session.mockReset().mockResolvedValue({ user: { id: "session-owner" } });
  mocks.provision.mockReset().mockResolvedValue({ replay: false, result: { businessId: "synthetic" } });
});
afterEach(() => vi.unstubAllEnvs());
const request = (body = "{}", origin = "http://localhost:3000") => new Request("http://localhost:3000/api/onboarding", { method: "POST", headers: { origin, "idempotency-key": "synthetic-key" }, body });
it("derives owner from session and returns creation/replay statuses", async () => {
  expect((await POST(request())).status).toBe(201);
  expect(mocks.provision).toHaveBeenCalledWith("session-owner", "synthetic-key", {});
  mocks.provision.mockResolvedValue({ replay: true, result: {} });
  expect((await POST(request())).status).toBe(200);
});
it("rejects external origin, missing session, oversized and malformed bodies", async () => {
  expect((await POST(request("{}", "https://external.example"))).status).toBe(403);
  mocks.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  mocks.session.mockResolvedValue({ user: { id: "session-owner" } });
  expect((await POST(request("x".repeat(16385)))).status).toBe(413);
  expect((await POST(request("{"))).status).toBe(400);
  expect(mocks.provision).not.toHaveBeenCalled();
});
it("returns safe 503 on session infrastructure errors", async () => {
  mocks.session.mockRejectedValue(new Error("PRIVATE_ERROR"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_ERROR");
});
it("recusa a chave de idempotência zerada antes de ler a sessão", async () => {
  const response = await POST(new Request("http://localhost:3000/api/onboarding", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      "idempotency-key": "00000000-0000-4000-8000-000000000000",
    },
    body: "{}",
  }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: { code: "invalid_idempotency_key", message: "Essa chave não é válida. Tente de novo." },
  });
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.provision).not.toHaveBeenCalled();
});

it("recusa Origin null no onboarding mesmo com same-origin", async () => {
  const response = await POST(new Request("http://localhost:3000/api/onboarding", {
    method: "POST",
    headers: { origin: "null", "sec-fetch-site": "same-origin", "idempotency-key": "6f1c2a40-7b52-4a1e-9c33-0d5e8a7b1c24" },
    body: "{}",
  }));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  expect(response.headers.has("access-control-allow-credentials")).toBe(false);
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.provision).not.toHaveBeenCalled();
});

it("recusa o preflight do onboarding com Origin null", async () => {
  const response = await OPTIONS(new Request("http://localhost:3000/api/onboarding", {
    method: "OPTIONS",
    headers: { origin: "null", "sec-fetch-site": "same-origin", "access-control-request-method": "POST" },
  }));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  expect(response.headers.has("access-control-allow-credentials")).toBe(false);
});

it("allows credentialed onboarding preflight including idempotency header", async () => {
  const response = await OPTIONS(new Request("http://localhost:3000/api/onboarding", { method: "OPTIONS", headers: { origin: "http://localhost:3000", "access-control-request-method": "POST", "access-control-request-headers": "Content-Type, Idempotency-Key" } }));
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
});
