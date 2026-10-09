import { afterEach, describe, expect, it, vi } from "vitest";
import { tenantScopedHash } from "../../lib/bookings/rate-limit";
import { bookingAccessSecret, rateLimitSecret } from "../../lib/env";

const auth = "main-secret-32-characters-long-aaaaaaa";

afterEach(() => vi.unstubAllEnvs());

describe("segredos separados", () => {
  it("usa RATE_LIMIT_SECRET quando existe e cai no segredo de auth se faltar", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", auth);
    vi.stubEnv("RATE_LIMIT_SECRET", "rate-limit-secret-32-chars-bbbbbb");
    const dedicated = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");
    vi.stubEnv("BETTER_AUTH_SECRET", "different-main-secret-32-chars-ccc");
    expect(tenantScopedHash("booking-rate:v1", "biz-123", "client-abc")).toBe(dedicated);
    vi.stubEnv("RATE_LIMIT_SECRET", "");
    expect(tenantScopedHash("booking-rate:v1", "biz-123", "client-abc")).not.toBe(dedicated);
    expect(rateLimitSecret({ BETTER_AUTH_SECRET: auth, RATE_LIMIT_SECRET: "short" })).toBeNull();
  });

  it("BOOKING_ACCESS_SECRET não acompanha a rotação do segredo de sessão", () => {
    const access = "booking-access-secret-32-chars-dddd";
    expect(bookingAccessSecret({ BETTER_AUTH_SECRET: auth, BOOKING_ACCESS_SECRET: access })).toBe(access);
    expect(bookingAccessSecret({ BETTER_AUTH_SECRET: auth })).toBe(auth);
    expect(bookingAccessSecret({ BETTER_AUTH_SECRET: auth, BOOKING_ACCESS_SECRET: "" })).toBe(auth);
  });
});
