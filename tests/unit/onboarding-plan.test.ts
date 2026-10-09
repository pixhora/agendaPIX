import { describe, expect, it } from "vitest";
import { assertOnboardingPlanForSale, createOnboardingDraft } from "../../lib/onboarding/drafts";
import { draftBodyFromOnboarding, onboardingPlanForEnv, restoreOnboardingDraft } from "../../lib/onboarding/flow";

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

  it("no passo 4 de ?plano=base manda base e HH:mm mesmo com completo e segundos guardados", () => {
    const stored = {
      plan: "completo" as const,
      businessName: "Studio Repro",
      slug: "studio-repro",
      serviceName: "Corte",
      durationMinutes: 45,
      priceCents: 5000,
      depositCents: 0,
      depositMode: "30" as const,
      openDays: [1, 2, 3, 4, 5, 6],
      opensAt: "09:00:00",
      closesAt: "19:00:00",
      email: "dona@studio.com.br",
    };
    const data = restoreOnboardingDraft(stored, onboardingPlanForEnv("base", "production"));
    const body = draftBodyFromOnboarding(data);
    expect(body.plan).toBe("base");
    expect(body.segment).toBe("outro");
    expect(body.email).toBe("dona@studio.com.br");
    expect(body.data.business).toMatchObject({ name: "Studio Repro", slug: "studio-repro", timezone: "America/Sao_Paulo" });
    expect(body.data.service).toEqual({ name: "Corte", durationMinutes: 45, priceCents: 5000, depositCents: 1500 });
    expect(body.data.hours[0]).toEqual({ weekday: 1, opensAt: "09:00", closesAt: "19:00" });
    expect(body.data.hours).toHaveLength(6);
  });
});
