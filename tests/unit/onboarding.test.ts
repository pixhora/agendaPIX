import { expect, it } from "vitest";
import { isReservedBusinessSlug, RESERVED_BUSINESS_SLUGS, slugSchema } from "../../lib/bookings/validation";
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

it.each([...RESERVED_BUSINESS_SLUGS])("rejects reserved business slug %s via onboarding schema", (slug) => {
  // Formato inválido (_next, favicon.ico) já cai no regex; o restante no refine de reservados.
  expect(onboardingInputSchema.safeParse({ ...input, business: { ...input.business, slug } }).success).toBe(false);
  expect(isReservedBusinessSlug(slug)).toBe(true);
  expect(isReservedBusinessSlug(slug.toUpperCase())).toBe(true);
});

it.each(["login", "onboarding", "preview", "dashboard", "api", "admin", "auth", "health", "ready", "webhooks", "static"])(
  "slugSchema rejects reserved slug %s that matches the format",
  (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  },
);

it("accepts ordinary business slugs", () => {
  expect(slugSchema.parse("barbearia-demo")).toBe("barbearia-demo");
  expect(onboardingInputSchema.safeParse(input).success).toBe(true);
});
