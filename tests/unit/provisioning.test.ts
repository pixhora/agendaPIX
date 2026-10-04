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

describe("Provisioning Contract (F-01)", () => {
  it("builds valid payload conforming strictly to database schema", () => {
    const payload = buildProvisioningPayload(mockOnboardingData);
    expect(payload.businessName).toBe("Barbearia do Silva");
    expect(payload.slug).toBe("barbearia-do-silva");
    expect(payload.service.priceCents).toBe(5000);
    expect(payload.service.depositCents).toBe(2000);
    expect(payload.hours.openDays).toEqual([1, 2, 3, 4, 5]);
  });

  it("fails validation when deposit is greater than price", () => {
    const invalidData: OnboardingData = {
      ...mockOnboardingData,
      depositCents: 6000,
      priceCents: 5000,
    };
    expect(() => buildProvisioningPayload(invalidData)).toThrow();
  });

  it("handles 404/501 gracefully as not_implemented before T1 contract is live", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const res = await provisionBusiness(mockOnboardingData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("not_implemented");
    }
  });

  it("returns ok: true when backend returns 201 with businessId and slug", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ businessId: "uuid-1234", slug: "barbearia-do-silva" }),
    });

    const res = await provisionBusiness(mockOnboardingData);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.businessId).toBe("uuid-1234");
      expect(res.slug).toBe("barbearia-do-silva");
    }
  });
});
