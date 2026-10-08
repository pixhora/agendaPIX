import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http";

const mocks = vi.hoisted(() => ({ session: vi.fn(), checkout: vi.fn() }));
vi.mock("../../lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("../../lib/billing/checkout", async () => {
  const actual = await vi.importActual<typeof import("../../lib/billing/checkout")>("../../lib/billing/checkout");
  return { ...actual, startSubscriptionCheckout: mocks.checkout };
});

import { OPTIONS, POST } from "../../app/api/businesses/[businessId]/subscription/checkout/route";

const businessId = "6e4b4a1b-d218-4e6a-92c9-94de45059c4f";
const result = {
  provider: "manual" as const,
  request: { id: "4eeb8372-55cd-4d11-910e-62d4e4374011", requestedAt: "2026-10-08T23:10:00.000Z" },
  whatsappUrl: "https://wa.me/5500000000000?text=Quero%20assinar%20o%20AgendaPix.",
  activationHours: 5,
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-subscription-secret-at-least-32-characters");
  mocks.session.mockReset().mockResolvedValue({ user: { id: "owner-1" } });
  mocks.checkout.mockReset().mockResolvedValue(result);
});
afterEach(() => vi.unstubAllEnvs());

function request(accept: string, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/businesses/${businessId}/subscription/checkout`, {
    method: "POST",
    headers: { origin, accept },
  });
}
const context = { params: Promise.resolve({ businessId }) };

it("redireciona o form e devolve JSON quando o Accept pede", async () => {
  const form = await POST(request("text/html"), context);
  expect(form.status).toBe(303);
  expect(form.headers.get("location")).toBe(result.whatsappUrl);
  expect(mocks.checkout).toHaveBeenCalledWith(businessId, "owner-1");
  const json = await POST(request("application/json"), context);
  expect(json.status).toBe(200);
  expect(await json.json()).toEqual(result);
});

it("devolve erro em JSON no form, sem Location", async () => {
  mocks.checkout.mockRejectedValue(new HttpError(503, "checkout_unavailable", "A assinatura por aqui está indisponível no momento."));
  const response = await POST(request("text/html"), context);
  expect(response.status).toBe(503);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("location")).toBeNull();
  expect(await response.json()).toMatchObject({ error: { code: "checkout_unavailable" } });

  mocks.checkout.mockRejectedValue(new HttpError(409, "subscription_already_active", "Sua assinatura já está ativa."));
  const conflict = await POST(request("text/html"), context);
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toMatchObject({ error: { code: "subscription_already_active" } });
});

it("recusa sessão e origem como as outras rotas do dono", async () => {
  mocks.session.mockResolvedValue(null);
  const unauthorized = await POST(request("text/html"), context);
  expect(unauthorized.status).toBe(401);
  expect(await unauthorized.json()).toMatchObject({ error: { code: "unauthorized" } });
  mocks.session.mockResolvedValue({ user: { id: "owner-1" } });
  const forbidden = await POST(request("application/json", "https://externo.example"), context);
  expect(forbidden.status).toBe(403);
  expect(await forbidden.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
  expect(mocks.checkout).not.toHaveBeenCalled();
});

it("libera o preflight do POST", async () => {
  const response = await OPTIONS(new Request("http://localhost:3000/api/businesses/x/subscription/checkout", {
    method: "OPTIONS",
    headers: { origin: "http://localhost:3000", "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
  }));
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-methods")).toContain("POST");
});
