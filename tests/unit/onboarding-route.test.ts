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
it("allows credentialed onboarding preflight including idempotency header", async () => {
  const response = await OPTIONS(new Request("http://localhost:3000/api/onboarding", { method: "OPTIONS", headers: { origin: "http://localhost:3000", "access-control-request-method": "POST", "access-control-request-headers": "Content-Type, Idempotency-Key" } }));
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
});
