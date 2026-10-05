import { describe, expect, it } from "vitest";
import { availableSlots } from "../../lib/bookings/availability";
import { bookingInputSchema } from "../../lib/bookings/validation";

const input = { date: "2030-01-01", timezone: "America/Sao_Paulo", durationMinutes: 30, hours: { opensAt: "09:00:00", closesAt: "10:00:00" }, busy: [], now: new Date("2029-12-31T00:00:00Z") };

describe("disponibilidade pública", () => {
  it("usa hora local do negócio e respeita o fechamento", () => {
    expect(availableSlots(input).map((slot) => slot.startsAt.toISOString())).toEqual(["2030-01-01T12:00:00.000Z", "2030-01-01T12:30:00.000Z"]);
  });
  it("não revela horário passado ou dia fechado", () => {
    expect(availableSlots({ ...input, hours: null })).toEqual([]);
    expect(availableSlots({ ...input, now: new Date("2030-01-01T12:00:00Z") })).toHaveLength(1);
  });
  it("bloqueia interseção e permite início no fim do horário anterior", () => {
    const busy = [{ startsAt: new Date("2030-01-01T12:00:00Z"), endsAt: new Date("2030-01-01T12:30:00Z") }];
    expect(availableSlots({ ...input, busy }).map((slot) => slot.startsAt.toISOString())).toEqual(["2030-01-01T12:30:00.000Z"]);
  });
  it("não gera hora inexistente na mudança de horário de verão", () => {
    const slots = availableSlots({ ...input, date: "2030-03-10", timezone: "America/New_York", hours: { opensAt: "02:00:00", closesAt: "03:00:00" } });
    expect(slots).toEqual([]);
  });
  it("rejeita preço fornecido pelo cliente e data sem fuso", () => {
    const body = { serviceId: "550e8400-e29b-41d4-a716-446655440000", startsAt: "2030-01-01T12:00:00Z", customer: { name: "Cliente", phone: "+5511999999999" , cpfCnpj: "52998224725" } };
    expect(bookingInputSchema.safeParse({ ...body, priceCents: 1 }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...body, startsAt: "2030-01-01T12:00:00" }).success).toBe(false);
    expect(bookingInputSchema.parse({ ...body, startsAt: "2030-01-01T09:00:00-03:00" }).startsAt).toBe("2030-01-01T12:00:00.000Z");
  });
});
