import { expect, it } from "vitest";
import { onboardingInputSchema } from "../../lib/onboarding/validation";
const input = { business: { name: " Salão ", slug: "salao" }, service: { name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 }, hours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00" }] };
it("normalizes names and supplies the existing timezone", () => {
  expect(onboardingInputSchema.parse(input).business).toEqual({ name: "Salão", slug: "salao", timezone: "America/Sao_Paulo" });
});
it("rejects tenant injection, invalid timezone, money, duplicate days and intervals", () => {
  for (const value of [
    { ...input, ownerId: "other" },
    { ...input, business: { ...input.business, timezone: "invalid" } },
    { ...input, service: { ...input.service, depositCents: 5001 } },
    { ...input, hours: [input.hours[0], input.hours[0]] },
    { ...input, hours: [{ weekday: 1, opensAt: "18:00", closesAt: "09:00" }] },
  ]) expect(onboardingInputSchema.safeParse(value).success).toBe(false);
});
