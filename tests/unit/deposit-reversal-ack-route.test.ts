import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ack: vi.fn(),
  session: vi.fn(),
}));
vi.mock("../../lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("../../db", () => ({ getDb: () => ({ marker: "db" }) }));
vi.mock("../../lib/payments/deposit-reversal-ack", () => ({ acknowledgeDepositReversal: mocks.ack }));

import { POST } from "../../app/api/businesses/[businessId]/bookings/[bookingId]/deposit-reversal/ack/route";

const businessId = "4eeb8372-55cd-4d11-910e-62d4e4374011";
const bookingId = "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-deposit-ack-secret-at-least-32-characters");
  mocks.ack.mockReset();
  mocks.session.mockReset().mockResolvedValue({ user: { id: "owner-a" } });
});
afterEach(() => vi.unstubAllEnvs());

it("recusa origem fora da allowlist e não marca o aviso", async () => {
  const response = await POST(new Request(`http://localhost:3000/api/businesses/${businessId}/bookings/${bookingId}/deposit-reversal/ack`, { method: "POST" }), {
    params: Promise.resolve({ businessId, bookingId }),
  });
  expect(response.status).toBe(403);
  expect(mocks.ack).not.toHaveBeenCalled();
});

it("com origem permitida encaminha dono, negócio e reserva", async () => {
  mocks.ack.mockResolvedValue({ bookingId, depositStatus: "refunded", depositReversalSeenAt: "2030-01-01T12:00:00.000Z" });
  const response = await POST(new Request(`http://localhost:3000/api/businesses/${businessId}/bookings/${bookingId}/deposit-reversal/ack`, {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  }), { params: Promise.resolve({ businessId, bookingId }) });
  expect(response.status).toBe(200);
  expect(mocks.ack).toHaveBeenCalledWith({ marker: "db" }, { ownerId: "owner-a", businessId, bookingId });
});
