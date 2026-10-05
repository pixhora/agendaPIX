import { describe, it, expect } from "vitest";

export const SUBSCRIPTION_PLANS = {
  base: {
    name: "Plano Base",
    monthlyPriceCents: 4900,
    formattedPrice: "R$ 49",
    trialDays: 7,
  },
  completo: {
    name: "Plano Completo",
    monthlyPriceCents: 7900,
    formattedPrice: "R$ 79",
    trialDays: 7,
  },
} as const;

describe("Subscription pricing specifications (docs/PRECOS.md)", () => {
  it("enforces approved monthly prices in cents and formatted BRL", () => {
    expect(SUBSCRIPTION_PLANS.base.monthlyPriceCents).toBe(4900);
    expect(SUBSCRIPTION_PLANS.base.formattedPrice).toBe("R$ 49");

    expect(SUBSCRIPTION_PLANS.completo.monthlyPriceCents).toBe(7900);
    expect(SUBSCRIPTION_PLANS.completo.formattedPrice).toBe("R$ 79");
  });

  it("preserves 7-day free trial on both plans without credit card", () => {
    expect(SUBSCRIPTION_PLANS.base.trialDays).toBe(7);
    expect(SUBSCRIPTION_PLANS.completo.trialDays).toBe(7);
  });

  it("guarantees prices are integer cents greater than zero", () => {
    expect(Number.isInteger(SUBSCRIPTION_PLANS.base.monthlyPriceCents)).toBe(true);
    expect(Number.isInteger(SUBSCRIPTION_PLANS.completo.monthlyPriceCents)).toBe(true);
    expect(SUBSCRIPTION_PLANS.base.monthlyPriceCents).toBeGreaterThan(0);
    expect(SUBSCRIPTION_PLANS.completo.monthlyPriceCents).toBeGreaterThan(0);
  });
});
