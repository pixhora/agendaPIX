import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  cancel: vi.fn(),
  pay: vi.fn(),
  preview: vi.fn(),
  session: vi.fn(),
}));
vi.mock("../../lib/bookings/slot-link", () => ({
  openSlotLink: mocks.open,
  cancelSlotLink: mocks.cancel,
  paySlotLink: mocks.pay,
  readSlotLinkPreview: mocks.preview,
}));
vi.mock("../../lib/auth", () => ({ getAuth: () => ({ api: { getSession: (input: { headers: Headers }) => mocks.session(input) } }) }));

import { GET as openGet } from "../../app/api/public/[slug]/slot-links/[token]/route";
import { POST as payPost } from "../../app/api/public/[slug]/slot-links/[token]/pay/route";
import { GET as previewGet } from "../../app/api/public/slot-link-previews/[previewId]/route";
import { GET as listGet } from "../../app/api/businesses/[businessId]/slot-links/route";
import { POST as cancelPost } from "../../app/api/businesses/[businessId]/slot-links/[linkId]/cancel/route";
import { POST as createPost } from "../../app/api/businesses/[businessId]/slot-links/route";

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
  mocks.pay.mockReset().mockResolvedValue({ bookingId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c" });
  mocks.preview.mockReset().mockResolvedValue({ kind: "slot", businessName: "Salao", logoUrl: null, serviceName: "Corte", date: "2030-01-01", time: "09:00" });
  mocks.session.mockReset().mockResolvedValue({ user: { id: "owner-1" } });
});
afterEach(() => vi.unstubAllEnvs());

it("a resposta do token não guarda cache nem referrer", async () => {
  const response = await openGet(new Request("http://localhost:3000/api/public/salao/slot-links/" + token), {
    params: Promise.resolve({ slug: "salao", token }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
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

const businessId = "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
const linkId = "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c";
const forged = { "x-forwarded-for": "203.0.113.8, 198.51.100.22" };

it("X-Forwarded-For forjado não vira a identidade: vale o último salto", async () => {
  await openGet(new Request("http://localhost:3000/api/public/salao/slot-links/" + token, { headers: forged }), {
    params: Promise.resolve({ slug: "salao", token }),
  });
  expect(mocks.open).toHaveBeenCalledWith("salao", token, "peer:198.51.100.22");
  expect(mocks.open.mock.calls[0][2]).not.toBe("peer:203.0.113.8");

  await payPost(new Request("http://localhost:3000/api/public/salao/slot-links/" + token + "/pay", {
    method: "POST",
    headers: { ...forged, "content-type": "application/json", "idempotency-key": "a".repeat(20) },
    body: "{}",
  }), { params: Promise.resolve({ slug: "salao", token }) });
  expect(mocks.pay.mock.calls[0][4]).toBe("peer:198.51.100.22");

  const previewId = "c".repeat(22);
  await previewGet(new Request("http://localhost:3000/api/public/slot-link-previews/" + previewId, { headers: forged }), {
    params: Promise.resolve({ previewId }),
  });
  expect(mocks.preview).toHaveBeenCalledWith(previewId, "peer:198.51.100.22");
});

it("a prévia não indexa e não guarda cache", async () => {
  const previewId = "d".repeat(22);
  const response = await previewGet(new Request("http://localhost:3000/api/public/slot-link-previews/" + previewId), {
    params: Promise.resolve({ previewId }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
});

it("rotas do dono sem sessão respondem 401", async () => {
  mocks.session.mockResolvedValue(null);
  const list = await listGet(new Request("http://localhost:3000/api/businesses/" + businessId + "/slot-links?date=2030-01-01"), {
    params: Promise.resolve({ businessId }),
  });
  expect(list.status).toBe(401);
  expect(await list.json()).toMatchObject({ error: { code: "unauthorized" } });

  const cancel = await cancelPost(new Request("http://localhost:3000/api/businesses/" + businessId + "/slot-links/" + linkId + "/cancel", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  }), { params: Promise.resolve({ businessId, linkId }) });
  expect(cancel.status).toBe(401);
  expect(await cancel.json()).toMatchObject({ error: { code: "unauthorized" } });

  const create = await createPost(new Request("http://localhost:3000/api/businesses/" + businessId + "/slot-links", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: "{}",
  }), { params: Promise.resolve({ businessId }) });
  expect(create.status).toBe(401);
  expect(mocks.cancel).not.toHaveBeenCalled();
});
