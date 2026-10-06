import { afterEach, expect, it, vi } from "vitest";
import { clearBookingCookie, extractBookingToken, setBookingCookie } from "../../lib/bookings/cookies";

afterEach(() => vi.unstubAllEnvs());

it("setBookingCookie cria cookie HttpOnly + SameSite=Strict com Secure em HTTPS", () => {
  const originalUrl = process.env.BETTER_AUTH_URL;
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  try {
    process.env.BETTER_AUTH_URL = "https://example.com";
    process.env.BETTER_AUTH_SECRET = "test-secret-with-32-characters-minimum";
    const cookie = setBookingCookie("abc123", { maxAge: 600 });
    expect(cookie).toContain("booking_access=abc123");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=600");
  } finally {
    process.env.BETTER_AUTH_URL = originalUrl;
    process.env.BETTER_AUTH_SECRET = originalSecret;
  }
});

it("setBookingCookie omite Secure em HTTP (dev local)", () => {
  const originalUrl = process.env.BETTER_AUTH_URL;
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  try {
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.BETTER_AUTH_SECRET = "test-secret-with-32-characters-minimum";
    const cookie = setBookingCookie("xyz789");
    expect(cookie).toContain("booking_access=xyz789");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("Secure");
  } finally {
    process.env.BETTER_AUTH_URL = originalUrl;
    process.env.BETTER_AUTH_SECRET = originalSecret;
  }
});

it("clearBookingCookie define Max-Age=0 e valor vazio", () => {
  const originalUrl = process.env.BETTER_AUTH_URL;
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  try {
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.BETTER_AUTH_SECRET = "test-secret-with-32-characters-minimum";
    const cookie = clearBookingCookie();
    expect(cookie).toContain("booking_access=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  } finally {
    process.env.BETTER_AUTH_URL = originalUrl;
    process.env.BETTER_AUTH_SECRET = originalSecret;
  }
});

it("extractBookingToken extrai token do cookie", () => {
  const request = new Request("http://localhost/test", {
    headers: { cookie: "other=value; booking_access=token123; another=val" },
  });
  expect(extractBookingToken(request)).toBe("token123");
});

it("extractBookingToken extrai token do header Authorization como fallback", () => {
  const request = new Request("http://localhost/test", {
    headers: { authorization: "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  });
  expect(extractBookingToken(request)).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
});

it("extractBookingToken prioriza cookie sobre Authorization", () => {
  const request = new Request("http://localhost/test", {
    headers: {
      cookie: "booking_access=fromcookie",
      authorization: "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
  expect(extractBookingToken(request)).toBe("fromcookie");
});

it("extractBookingToken retorna null quando não há token", () => {
  const request = new Request("http://localhost/test");
  expect(extractBookingToken(request)).toBeNull();
});

it("extractBookingToken retorna null para Bearer header malformado", () => {
  const request = new Request("http://localhost/test", {
    headers: { authorization: "Basic xyz" },
  });
  expect(extractBookingToken(request)).toBeNull();
});
