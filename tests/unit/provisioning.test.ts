import { describe, it, expect, vi } from "vitest";
import { buildProvisioningPayload, provisionBusiness } from "../../lib/provisioning";
import type { OnboardingData } from "../../components/onboarding/types";

const mockOnboardingData: OnboardingData = {
  plan: "base",
  businessName: "Barbearia do Silva",
  slug: "barbearia-do-silva",
  serviceName: "Corte Social",
  durationMinutes: 45,
  priceCents: 5000,
  depositCents: 2000,
  openDays: [1, 2, 3, 4, 5],
  opensAt: "09:00",
  closesAt: "19:00",
  email: "dono@barbearia.com",
};

describe("Provisioning contract (POST /api/onboarding)", () => {
  it("builds a payload accepted by the real onboarding schema", () => {
    const payload = buildProvisioningPayload(mockOnboardingData);
    expect(payload.business.name).toBe("Barbearia do Silva");
    expect(payload.business.slug).toBe("barbearia-do-silva");
    expect(payload.business.timezone).toBe("America/Sao_Paulo");
    expect(payload.service.name).toBe("Corte Social");
    expect(payload.service.priceCents).toBe(5000);
    expect(payload.service.depositCents).toBe(2000);
    expect(payload.hours).toHaveLength(5);
    expect(payload.hours[0]).toEqual({ weekday: 1, opensAt: "09:00", closesAt: "19:00" });
  });

  it("fails validation when deposit is greater than price", () => {
    const invalidData: OnboardingData = {
      ...mockOnboardingData,
      depositCents: 6000,
      priceCents: 5000,
    };
    expect(() => buildProvisioningPayload(invalidData)).toThrow();
  });

  it("posts same-origin to /api/onboarding with the Idempotency-Key", async () => {
    const key = "e58b8f2c-e12b-4b1f-8234-90a6184a5111";
    let capturedHeaders: Record<string, string> = {};
    let capturedCredentials = "";
    let capturedUrl = "";

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers as Record<string, string>;
      capturedCredentials = init?.credentials as string;
      return {
        ok: true,
        status: 201,
        json: async () => ({
          businessId: "biz-123",
          slug: "barbearia-do-silva",
          publicPath: "/barbearia-do-silva",
          serviceId: "srv-456",
        }),
      };
    });

    const res = await provisionBusiness(mockOnboardingData, { idempotencyKey: key });
    expect(res.ok).toBe(true);
    expect(capturedHeaders["Idempotency-Key"]).toBe(key);
    expect(capturedCredentials).toBe("same-origin");
    expect(capturedUrl).toBe("/api/onboarding");
  });

  it("handles 409 conflict and idempotency_conflict properly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: "idempotency_conflict", message: "Conflito de chave" } }),
    });

    const res = await provisionBusiness(mockOnboardingData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("idempotency_conflict");
    }
  });

  it("maps slug_unavailable (409) to conflict", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: "slug_unavailable", message: "Esse endereço já está em uso. Escolha outro." } }),
    });

    const res = await provisionBusiness(mockOnboardingData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("conflict");
    }
  });

  it("handles 401 unauthorized when user session is not present", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: "unauthorized" }),
    });

    const res = await provisionBusiness(mockOnboardingData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("unauthorized");
    }
  });
});
