import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tenantScopedHash } from "../../lib/bookings/rate-limit";

describe("Secrets dedicados para booking", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("RATE_LIMIT_SECRET", () => {
    it("usa RATE_LIMIT_SECRET quando configurado", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      process.env.RATE_LIMIT_SECRET = "rate-limit-secret-32-chars-bbbbbb";

      const hash1 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");
      
      // Troca o BETTER_AUTH_SECRET, mas mantém RATE_LIMIT_SECRET
      process.env.BETTER_AUTH_SECRET = "different-main-secret-32-chars-ccc";
      const hash2 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");

      // Hash deve ser idêntico porque usa RATE_LIMIT_SECRET
      expect(hash1).toBe(hash2);
    });

    it("fallback para BETTER_AUTH_SECRET quando RATE_LIMIT_SECRET ausente", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      delete process.env.RATE_LIMIT_SECRET;

      const hash1 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");

      // Troca o BETTER_AUTH_SECRET
      process.env.BETTER_AUTH_SECRET = "different-main-secret-32-chars-ccc";
      const hash2 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");

      // Hash deve mudar porque usa BETTER_AUTH_SECRET como fallback
      expect(hash1).not.toBe(hash2);
    });

    it("secrets diferentes produzem hashes diferentes", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      process.env.RATE_LIMIT_SECRET = "rate-limit-secret-32-chars-bbbbbb";

      const hash1 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");

      process.env.RATE_LIMIT_SECRET = "different-rate-limit-32-chars-dddd";
      const hash2 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");

      expect(hash1).not.toBe(hash2);
    });

    it("rejeita RATE_LIMIT_SECRET muito curto", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      process.env.RATE_LIMIT_SECRET = "short"; // menos de 32 chars

      expect(() => {
        tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");
      }).toThrow();
    });

    it("aceita RATE_LIMIT_SECRET ausente (usa fallback)", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      delete process.env.RATE_LIMIT_SECRET;

      const hash = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");
      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("Tenant scoping", () => {
    it("hashes diferentes para negócios diferentes", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      process.env.RATE_LIMIT_SECRET = "rate-limit-secret-32-chars-bbbbbb";

      const hash1 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");
      const hash2 = tenantScopedHash("booking-rate:v1", "biz-456", "client-abc");

      expect(hash1).not.toBe(hash2);
    });

    it("hashes diferentes para clientes diferentes", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      process.env.RATE_LIMIT_SECRET = "rate-limit-secret-32-chars-bbbbbb";

      const hash1 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");
      const hash2 = tenantScopedHash("booking-rate:v1", "biz-123", "client-xyz");

      expect(hash1).not.toBe(hash2);
    });

    it("hashes diferentes para propósitos diferentes", () => {
      process.env.BETTER_AUTH_SECRET = "main-secret-32-characters-long-aaaaaaa";
      process.env.RATE_LIMIT_SECRET = "rate-limit-secret-32-chars-bbbbbb";

      const hash1 = tenantScopedHash("booking-rate:v1", "biz-123", "client-abc");
      const hash2 = tenantScopedHash("other-purpose:v1", "biz-123", "client-abc");

      expect(hash1).not.toBe(hash2);
    });
  });
});
