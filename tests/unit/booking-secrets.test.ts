import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { accessTokenForStoredHash, bookingAccessMacMatches, bookingAccessTokenMatches, signBookingAccessToken } from "../../lib/bookings/access-mac";
import { slotLinkPayIdempotencyHash, slotLinkPayMessage } from "../../lib/bookings/slot-link";
import { tenantScopedHash } from "../../lib/bookings/rate-limit";
import { bookingAccessSecret, bookingAccessSecretPrevious, rateLimitSecret } from "../../lib/env";

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

  it("em produção não cai no segredo de sessão", () => {
    const access = "booking-access-secret-32-chars-dddd";
    const production = { NODE_ENV: "production", BETTER_AUTH_SECRET: auth };
    expect(bookingAccessSecret(production)).toBeNull();
    expect(bookingAccessSecret({ ...production, BOOKING_ACCESS_SECRET: "" })).toBeNull();
    expect(bookingAccessSecret({ ...production, BOOKING_ACCESS_SECRET: "   " })).toBeNull();
    expect(bookingAccessSecret({ ...production, BOOKING_ACCESS_SECRET: "curto" })).toBeNull();
    expect(bookingAccessSecret({ ...production, BOOKING_ACCESS_SECRET: auth })).toBeNull();
    expect(bookingAccessSecret({ ...production, BOOKING_ACCESS_SECRET: access })).toBe(access);
    expect(bookingAccessSecret({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      BETTER_AUTH_SECRET: auth,
    })).toBe(auth);
    expect(bookingAccessSecret({
      VERCEL_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      BETTER_AUTH_SECRET: auth,
      BOOKING_ACCESS_SECRET: access,
    })).toBe(access);
    expect(bookingAccessSecret({
      VERCEL_ENV: "production",
      BETTER_AUTH_SECRET: auth,
    })).toBeNull();
    expect(bookingAccessSecret({
      VERCEL_ENV: "preview",
      BETTER_AUTH_SECRET: auth,
    })).toBeNull();
    expect(bookingAccessSecret({
      VERCEL_ENV: "preview",
      BETTER_AUTH_SECRET: auth,
      BOOKING_ACCESS_SECRET: "replace-this-booking-access-secret-32",
    })).toBeNull();
    expect(bookingAccessSecret({
      VERCEL_ENV: "preview",
      BETTER_AUTH_SECRET: auth,
      BOOKING_ACCESS_SECRET: access,
    })).toBe(access);
    expect(bookingAccessSecret({ NODE_ENV: "test", BETTER_AUTH_SECRET: auth, BOOKING_ACCESS_SECRET: "" })).toBe(auth);
  });

  it("verifica token do segredo atual ou do anterior e assina só com o atual", () => {
    const current = "booking-access-secret-32-chars-dddd";
    const previous = "booking-access-secret-32-chars-eeee";
    const other = "booking-access-secret-32-chars-ffff";
    const businessId = "11111111-1111-4111-8111-111111111111";
    const bookingId = "22222222-2222-4222-8222-222222222222";
    const message = `booking-access:v1:${businessId}:${bookingId}`;
    const env = {
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: auth,
      BOOKING_ACCESS_SECRET: current,
      BOOKING_ACCESS_SECRET_PREVIOUS: previous,
    };
    const signedCurrent = signBookingAccessToken(businessId, bookingId, env);
    const signedPrevious = createHmac("sha256", previous).update(message).digest("base64url");
    const signedOther = createHmac("sha256", other).update(message).digest("base64url");
    const signedAuth = createHmac("sha256", auth).update(message).digest("base64url");
    expect(signedCurrent).toBe(createHmac("sha256", current).update(message).digest("base64url"));
    expect(signedCurrent).not.toBe(signedPrevious);
    expect(bookingAccessTokenMatches(signedPrevious, businessId, bookingId, env)).toBe(true);
    expect(bookingAccessTokenMatches(signedCurrent ?? "", businessId, bookingId, env)).toBe(true);
    expect(bookingAccessTokenMatches(signedOther, businessId, bookingId, env)).toBe(false);
    const withoutPrevious = { ...env, BOOKING_ACCESS_SECRET_PREVIOUS: "" };
    expect(bookingAccessTokenMatches(signedPrevious, businessId, bookingId, withoutPrevious)).toBe(false);
    expect(bookingAccessTokenMatches(signedAuth, businessId, bookingId, withoutPrevious)).toBe(false);
    expect(bookingAccessTokenMatches(signedAuth, businessId, bookingId, {
      ...withoutPrevious,
      BOOKING_ACCESS_SECRET_PREVIOUS: auth,
    })).toBe(true);

    const linkId = "33333333-3333-4333-8333-333333333333";
    const key = "idempotency-key-1234";
    const payMessage = slotLinkPayMessage(linkId, key);
    const currentPay = createHmac("sha256", current).update(payMessage).digest("hex");
    const previousPay = createHmac("sha256", previous).update(payMessage).digest("hex");
    const otherPay = createHmac("sha256", other).update(payMessage).digest("hex");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BETTER_AUTH_SECRET", auth);
    vi.stubEnv("BOOKING_ACCESS_SECRET", current);
    vi.stubEnv("BOOKING_ACCESS_SECRET_PREVIOUS", previous);
    expect(slotLinkPayIdempotencyHash(linkId, key)).toBe(currentPay);
    expect(bookingAccessMacMatches(previousPay, payMessage, "hex")).toBe(true);
    expect(bookingAccessMacMatches(currentPay, payMessage, "hex")).toBe(true);
    expect(bookingAccessMacMatches(otherPay, payMessage, "hex")).toBe(false);
    expect(bookingAccessSecretPrevious({ BOOKING_ACCESS_SECRET_PREVIOUS: "curto" })).toBeNull();
    expect(bookingAccessSecretPrevious({ BOOKING_ACCESS_SECRET_PREVIOUS: previous })).toBe(previous);
    expect(bookingAccessMacMatches(previousPay, payMessage, "hex", { ...env, BOOKING_ACCESS_SECRET_PREVIOUS: "curto" })).toBe(false);

    const stored = createHash("sha256").update(signedPrevious).digest("hex");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(accessTokenForStoredHash(businessId, bookingId, stored, env)).toBe(signedPrevious);
    expect(warn).not.toHaveBeenCalled();
    const unknown = createHash("sha256").update("outro-token").digest("hex");
    expect(accessTokenForStoredHash(businessId, bookingId, unknown, env)).toBe(signedCurrent);
    const text = warn.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(text).toContain(bookingId);
    expect(text).toContain("BOOKING_ACCESS_SECRET_PREVIOUS");
    expect(text).toContain("não pode ser restaurado");
    expect(text).not.toContain(unknown);
    expect(text).not.toContain(signedCurrent);
    expect(text).not.toContain(signedPrevious);
    expect(text).not.toContain(current);
    expect(text).not.toContain(previous);
    warn.mockRestore();
  });
});
