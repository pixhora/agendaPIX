import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ open: vi.fn(), cancel: vi.fn() }));
vi.mock("../../lib/bookings/slot-link", () => ({
  openSlotLink: mocks.open,
  cancelSlotLink: mocks.cancel,
}));
vi.mock("../../lib/auth", () => ({ getAuth: () => ({ api: { getSession: vi.fn().mockResolvedValue({ user: { id: "owner-1" } }) } }) }));

import { GET as openGet } from "../../app/api/public/[slug]/slot-links/[token]/route";
import { POST as cancelPost } from "../../app/api/businesses/[businessId]/slot-links/[linkId]/cancel/route";

const token = "B".repeat(43);
const opened = {
  business: { name: "Salao", slug: "salao", logoUrl: null, contactWhatsapp: null, publicPath: "/salao" },
  service: { id: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b", name: "Corte", durationMinutes: 30, priceCents: 8000, depositCents: 4000 },
  startsAt: "2030-01-01T12:00:00.000Z",
  depositCents: 4000,
  remainingCents: 4000,
  policy: null,
  expiresAt: "2030-01-01T11:00:00.000Z",
  status: "pending",
  requiresPayerCpf: false,
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-slot-link-secret-at-least-32-characters");
  mocks.open.mockReset().mockResolvedValue(opened);
  mocks.cancel.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

it("a resposta do token não guarda cache nem referrer", async () => {
  const response = await openGet(new Request("http://localhost:3000/api/public/salao/slot-links/" + token), {
    params: Promise.resolve({ slug: "salao", token }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(JSON.stringify(await response.json())).not.toContain(token);
});

it("cancelar sem a origem do app responde 403 e não chama o serviço", async () => {
  const response = await cancelPost(new Request("http://localhost:3000/api/businesses/6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b/slot-links/x/cancel", { method: "POST" }), {
    params: Promise.resolve({ businessId: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b", linkId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c" }),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "origin_not_allowed" } });
  expect(mocks.cancel).not.toHaveBeenCalled();
});
