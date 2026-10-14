import { describe, expect, it } from "vitest";
import type { OnboardingData } from "../../components/onboarding/types";
import { ONBOARDING_SEGMENTS } from "../../lib/onboarding/draft";
import { STORE_DURATION_MINUTES } from "../../lib/onboarding/validation";
import { SEGMENT_CHOICES, SEGMENT_TEMPLATES, applySegmentTemplate, templateDays } from "../../lib/onboarding/segment-templates";
import { emptyStoreDays } from "../../lib/store-profile/model";

const blank: OnboardingData = {
  plan: "base", businessName: "", slug: "", logoUrl: "", serviceName: "", durationMinutes: 0, priceCents: 0,
  depositCents: 0, openDays: [], opensAt: "", closesAt: "", email: "", days: emptyStoreDays(),
};

describe("modelos por tipo de negócio no cadastro", () => {
  it("cobre todos os segmentos do rascunho, com 'Outro' por último, e só durações aceitas", () => {
    expect(SEGMENT_CHOICES.map((choice) => choice.segment).sort()).toEqual([...ONBOARDING_SEGMENTS].sort());
    expect(SEGMENT_CHOICES.at(-1)).toEqual({ segment: "outro", label: "Outro" });
    for (const template of Object.values(SEGMENT_TEMPLATES)) {
      expect(STORE_DURATION_MINUTES).toContain(template.durationMinutes);
      expect(template.opensAt < template.closesAt).toBe(true);
    }
  });

  it("cadastro em branco recebe serviço, duração e horários, mas nunca preço nem sinal", () => {
    const patch = applySegmentTemplate(blank, "barbearia");
    expect(patch).toMatchObject({ segment: "barbearia", serviceName: "Corte masculino", durationMinutes: 30 });
    expect(patch.days?.filter((day) => day.open).map((day) => day.weekday)).toEqual([2, 3, 4, 5, 6]);
    expect(patch.days?.find((day) => day.weekday === 2)).toEqual({ weekday: 2, open: true, opensAt: "09:00", closesAt: "19:00" });
    expect(patch).not.toHaveProperty("priceCents");
    expect(patch).not.toHaveProperty("depositCents");
  });

  it("não sobrescreve o que o dono digitou", () => {
    const typed: OnboardingData = {
      ...blank, serviceName: "Degradê navalhado", durationMinutes: 45,
      days: emptyStoreDays().map((day) => day.weekday === 1 ? { ...day, open: true, opensAt: "08:00", closesAt: "12:00" } : day),
    };
    expect(applySegmentTemplate(typed, "barbearia")).toEqual({ segment: "barbearia" });
  });

  it("trocar de segmento troca só o que ainda era do modelo anterior", () => {
    const fromBarber = { ...blank, ...applySegmentTemplate(blank, "barbearia") } as OnboardingData;
    const patch = applySegmentTemplate(fromBarber, "unhas");
    expect(patch).toMatchObject({ segment: "unhas", serviceName: "Pé e mão", durationMinutes: 90 });
    expect(patch.days).toEqual(templateDays(SEGMENT_TEMPLATES.unhas));

    const edited = { ...fromBarber, serviceName: "Barba completa" };
    const keep = applySegmentTemplate(edited, "salao");
    expect(keep).not.toHaveProperty("serviceName");
    expect(keep.durationMinutes).toBe(60);
  });

  it("'Outro' só registra o segmento e mantém o que já estava", () => {
    const fromBarber = { ...blank, ...applySegmentTemplate(blank, "barbearia") } as OnboardingData;
    expect(applySegmentTemplate(fromBarber, "outro")).toEqual({ segment: "outro" });
  });
});
