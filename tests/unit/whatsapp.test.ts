import { describe, expect, it } from "vitest";
import { contactWhatsappSchema, normalizeContactWhatsapp } from "../../lib/validation/whatsapp";
import { onboardingInputSchema } from "../../lib/onboarding/validation";
const logoUrl = "https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/logos/test.webp";
const input = { business: { name: "Salão", slug: "salao", logoUrl, timezone: "America/Sao_Paulo" }, service: { name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 }, hours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00" }] };

describe("WhatsApp do negócio", () => {
  it("normaliza telefone brasileiro e rejeita lixo", () => {
    expect(normalizeContactWhatsapp(" (11) 99999-9999 ")).toBe("+5511999999999");
    expect(normalizeContactWhatsapp("")).toBeNull();
    expect(contactWhatsappSchema.parse("+5511999999999")).toBe("+5511999999999");
    expect(contactWhatsappSchema.safeParse("123").success).toBe(false);
  });

  it("aceita o campo no onboarding sem inventar política", () => {
    const parsed = onboardingInputSchema.parse({ ...input, business: { ...input.business, contactWhatsapp: "11999999999" } });
    expect(parsed.business.contactWhatsapp).toBe("+5511999999999");
    expect(parsed.service).not.toHaveProperty("depositPolicy");
    expect(onboardingInputSchema.parse(input).business.contactWhatsapp).toBeUndefined();
  });
});
