import { afterEach, expect, it, vi } from "vitest";
import { bookingClientIdentity } from "../../lib/bookings/rate-limit";
import { handleHttp, HttpError } from "../../lib/http";

afterEach(() => vi.unstubAllEnvs());
it("ignores spoofed client IP headers unless proxy trust is explicitly enabled", () => {
  vi.stubEnv("BOOKING_TRUST_PROXY", "false");
  const request = new Request("http://localhost", { headers: { "x-real-ip": "192.0.2.1", "x-forwarded-for": "198.51.100.1" } });
  expect(bookingClientIdentity(request)).toBe("anonymous");
  vi.stubEnv("BOOKING_TRUST_PROXY", "true");
  expect(bookingClientIdentity(request)).toBe("192.0.2.1");
  expect(bookingClientIdentity(new Request(request.url, { headers: { "x-real-ip": "192.0.2.1,198.51.100.1" } }))).toBe("anonymous");
});
it("exposes retry delay on rate limit responses", async () => {
  const response = await handleHttp(async () => { throw new HttpError(429, "rate_limited", "Aguarde.", 60); });
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
});
