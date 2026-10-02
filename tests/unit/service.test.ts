import { describe, expect, it } from "vitest";
import { centsSchema, serviceInputSchema } from "../../lib/validation/service";

const service = { name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 };

describe("valores em centavos", () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2147483648, "5000"])("rejeita valor inválido %s", (value) => {
    expect(centsSchema.safeParse(value).success).toBe(false);
  });
  it.each([0, 1, 5000, 2147483647])("aceita inteiro %s", (value) => {
    expect(centsSchema.parse(value)).toBe(value);
  });
  it("não permite sinal superior ao preço", () => {
    expect(serviceInputSchema.safeParse({ ...service, depositCents: 5001 }).success).toBe(false);
  });
  it("aceita sinal zero ou integral", () => {
    expect(serviceInputSchema.parse({ ...service, depositCents: 0 }).depositCents).toBe(0);
    expect(serviceInputSchema.parse({ ...service, depositCents: 5000 }).depositCents).toBe(5000);
  });
  it("rejeita campos extras e duração inválida", () => {
    expect(serviceInputSchema.safeParse({ ...service, ownerId: "outro" }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...service, durationMinutes: 0 }).success).toBe(false);
  });
});
