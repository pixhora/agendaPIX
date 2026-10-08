import { afterEach, describe, expect, it, vi } from "vitest";
import { bookingConfig } from "../../lib/bookings/config";
import { bookingClientIdentity, normalizeClientAddress } from "../../lib/bookings/rate-limit";
import { handleHttp, HttpError } from "../../lib/http";

afterEach(() => vi.unstubAllEnvs());
const request = (headers: Record<string, string>) => new Request("http://localhost/api/public/x/bookings", { headers });

describe("configuração antiabuso", () => {
  it("usa padrões seguros quando nada é configurado", () => {
    expect(bookingConfig({})).toEqual({
      BOOKING_TRUST_PROXY: false, BOOKING_CLIENT_IP_HEADER: "x-real-ip", BOOKING_TRUSTED_PROXY_HOPS: 1,
      BOOKING_RATE_LIMIT_PER_CLIENT: 10, BOOKING_RATE_LIMIT_PER_BUSINESS: 120,
      BOOKING_HOLD_MINUTES: 30, BOOKING_MAX_PENDING_PER_CLIENT: 3, BOOKING_MAX_PENDING_PER_PHONE: 2, BOOKING_MAX_PENDING_PER_BUSINESS: 50,
    });
    expect(bookingConfig({ BOOKING_HOLD_MINUTES: "", BOOKING_TRUST_PROXY: "" }).BOOKING_HOLD_MINUTES).toBe(30);
    expect(bookingConfig({ BOOKING_HOLD_MINUTES: "28" }).BOOKING_HOLD_MINUTES).toBe(28);
    expect(bookingConfig({ BOOKING_HOLD_MINUTES: "29" }).BOOKING_HOLD_MINUTES).toBe(29);
  });
  it("recusa hold abaixo de 28 porque o Pix ficaria com menos de 30 minutos", () => {
    expect(() => bookingConfig({ BOOKING_HOLD_MINUTES: "27" })).toThrow(expect.objectContaining({
      status: 503,
      code: "booking_unavailable",
      message: expect.stringContaining("28"),
    }));
    try {
      bookingConfig({ BOOKING_HOLD_MINUTES: "27" });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/30 minutos/);
      expect((error as Error).message).toMatch(/hold \+ 2/);
    }
  });
  it.each([
    { BOOKING_TRUST_PROXY: "yes" }, { BOOKING_CLIENT_IP_HEADER: "forwarded" }, { BOOKING_TRUSTED_PROXY_HOPS: "0" },
    { BOOKING_HOLD_MINUTES: "1" }, { BOOKING_HOLD_MINUTES: "27" }, { BOOKING_HOLD_MINUTES: "43201" }, { BOOKING_MAX_PENDING_PER_CLIENT: "0" },
    { BOOKING_RATE_LIMIT_PER_CLIENT: "20", BOOKING_RATE_LIMIT_PER_BUSINESS: "10" }, { BOOKING_MAX_PENDING_PER_BUSINESS: "abc" },
  ])("recusa configuração inválida %o com 503 em vez de cair em padrão silencioso", (env) => {
    expect(() => bookingConfig(env)).toThrow(expect.objectContaining({ status: 503, code: "booking_unavailable" }));
  });
});

describe("normalização de endereço", () => {
  it.each([
    ["192.0.2.1", "192.0.2.1"], [" 192.0.2.1:5555 ", "192.0.2.1"], ["::ffff:192.0.2.1", "192.0.2.1"],
    ["2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::/64"], ["[2001:db8:1:2::9]:443", "2001:db8:1:2::/64"],
    ["2001:0db8:0001:0002::1", "2001:db8:1:2::/64"], ["::1", "0:0:0:0::/64"],
  ])("%s → %s", (raw, expected) => expect(normalizeClientAddress(raw)).toBe(expected));
  it.each(["", "unknown", "192.0.2.1,198.51.100.1", "999.1.1.1", "<script>"])("rejeita %s", (raw) => expect(normalizeClientAddress(raw)).toBeNull());
  it("agrupa endereços do mesmo /64 IPv6 no mesmo balde", () => {
    expect(normalizeClientAddress("2001:db8:1:2::1")).toBe(normalizeClientAddress("2001:db8:1:2:ffff::7"));
    expect(normalizeClientAddress("2001:db8:1:2::1")).not.toBe(normalizeClientAddress("2001:db8:1:3::1"));
  });
});

describe("identidade do cliente", () => {
  it("sem proxy confiável usa o endereço do par (último X-Forwarded-For, preenchido pelo Next) e nunca um balde único", () => {
    const config = bookingConfig({});
    expect(bookingClientIdentity(request({ "x-forwarded-for": "198.51.100.7" }), config)).toBe("peer:198.51.100.7");
    expect(bookingClientIdentity(request({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" }), config)).toBe("peer:198.51.100.7");
    expect(bookingClientIdentity(request({ "x-real-ip": "192.0.2.1" }), config)).toBeNull();
    expect(bookingClientIdentity(request({}), config)).toBeNull();
    expect(bookingClientIdentity(request({ "x-forwarded-for": "198.51.100.7" }), config)).not.toBe(bookingClientIdentity(request({ "x-forwarded-for": "198.51.100.8" }), config));
  });
  it("com proxy confiável via X-Real-IP aceita somente um IP válido", () => {
    const config = bookingConfig({ BOOKING_TRUST_PROXY: "true" });
    expect(bookingClientIdentity(request({ "x-real-ip": "192.0.2.1", "x-forwarded-for": "198.51.100.1" }), config)).toBe("proxy:192.0.2.1");
    expect(bookingClientIdentity(request({ "x-real-ip": "192.0.2.1,198.51.100.1" }), config)).toBeNull();
    expect(bookingClientIdentity(request({}), config)).toBeNull();
  });
  it("com proxy confiável via X-Forwarded-For aplica rightmost-trusted pelo número de saltos", () => {
    const one = bookingConfig({ BOOKING_TRUST_PROXY: "true", BOOKING_CLIENT_IP_HEADER: "x-forwarded-for" });
    const two = bookingConfig({ BOOKING_TRUST_PROXY: "true", BOOKING_CLIENT_IP_HEADER: "x-forwarded-for", BOOKING_TRUSTED_PROXY_HOPS: "2" });
    // Cliente forja "6.6.6.6"; o proxy de borda anexa o IP real 203.0.113.5; um segundo proxy interno anexa 10.0.0.2.
    const spoofed = request({ "x-forwarded-for": "6.6.6.6, 203.0.113.5" });
    expect(bookingClientIdentity(spoofed, one)).toBe("proxy:203.0.113.5");
    expect(bookingClientIdentity(request({ "x-forwarded-for": "6.6.6.6, 203.0.113.5, 10.0.0.2" }), two)).toBe("proxy:203.0.113.5");
    expect(bookingClientIdentity(request({ "x-forwarded-for": "203.0.113.5" }), two)).toBeNull();
    expect(bookingClientIdentity(request({ "x-forwarded-for": "6.6.6.6, garbage" }), one)).toBeNull();
  });
  it("lê o ambiente atual quando nenhuma configuração é passada", () => {
    vi.stubEnv("BOOKING_TRUST_PROXY", "true");
    expect(bookingClientIdentity(request({ "x-real-ip": "192.0.2.1" }))).toBe("proxy:192.0.2.1");
  });
});

describe("respostas de limite", () => {
  it("expõe Retry-After em 429 e 409 com espera", async () => {
    const limited = await handleHttp(async () => { throw new HttpError(429, "rate_limited", "Aguarde.", 60); });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    const capacity = await handleHttp(async () => { throw new HttpError(409, "hold_capacity_reached", "Aguarde.", 12.2); });
    expect(capacity.status).toBe(409);
    expect(capacity.headers.get("retry-after")).toBe("13");
    expect((await handleHttp(async () => { throw new HttpError(409, "slot_unavailable", "Outro."); })).headers.has("retry-after")).toBe(false);
  });
});
