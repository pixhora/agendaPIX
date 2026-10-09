import { describe, expect, it } from "vitest";
import { assertOnboardingPlanForSale, createOnboardingDraft } from "../../lib/onboarding/drafts";
import { onboardingPlanForEnv } from "../../lib/onboarding/flow";

const completo = {
  email: "dona@example.com",
  segment: "barbearia",
  plan: "completo",
  data: {
    business: { name: "Studio", slug: "studio-bella" },
    service: { name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 },
    hours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00" }],
  },
};

describe("plano completo", () => {
  it("recusa em produção com code estável e aceita fora dela", async () => {
    expect(() => assertOnboardingPlanForSale("completo", "development")).not.toThrow();
    expect(() => assertOnboardingPlanForSale("completo", "test")).not.toThrow();
    expect(() => assertOnboardingPlanForSale("base", "production")).not.toThrow();
    await expect(createOnboardingDraft(completo, {} as never, { NODE_ENV: "production" })).rejects.toMatchObject({
      status: 400,
      code: "plan_unavailable",
    });
    expect(onboardingPlanForEnv("completo", "production")).toBe("base");
    expect(onboardingPlanForEnv(null, "development")).toBe("completo");
    expect(onboardingPlanForEnv("base", "development")).toBe("base");
  });
});
