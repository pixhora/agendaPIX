import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookingRequestDigest, bookingRequestMatches, legacyBookingRequestDigest } from "../../lib/bookings/service";

const base = {
  serviceId: "11111111-1111-4111-8111-111111111111",
  startsAt: "2030-01-01T15:00:00.000Z",
  customer: { name: "Ana", phone: "+5511987654321" },
  policyHash: "a".repeat(64),
};

describe("digest da reserva", () => {
  it("tira o CPF do hash novo e ainda reconhece o digest antigo", () => {
    const withCpf = { ...base, customer: { ...base.customer, cpfCnpj: "52998224725" } };
    const otherCpf = { ...base, customer: { ...base.customer, cpfCnpj: "39053344705" } };
    expect(bookingRequestDigest(withCpf)).toBe(bookingRequestDigest(base));
    expect(bookingRequestDigest(withCpf)).toBe(bookingRequestDigest(otherCpf));
    expect(bookingRequestDigest(withCpf)).not.toBe(legacyBookingRequestDigest(withCpf));
    expect(JSON.stringify({ ...withCpf, customer: base.customer })).not.toContain("52998224725");
    expect(bookingRequestMatches(legacyBookingRequestDigest(withCpf), withCpf)).toBe(true);
    expect(bookingRequestMatches(bookingRequestDigest(withCpf), otherCpf)).toBe(true);
    expect(bookingRequestMatches(legacyBookingRequestDigest(withCpf), { ...base, customer: { ...base.customer, name: "Bia" } })).toBe(false);
    expect(bookingRequestMatches(null, withCpf)).toBe(false);
  });

  it("a página pública não grava o CPF no sessionStorage", () => {
    const source = readFileSync("components/booking/BookingFlow.tsx", "utf8");
    expect(source).not.toContain("customerCpf:");
    expect(source).not.toContain("stored?.customerCpf");
    expect(source).not.toContain("stored.customerCpf");
    expect(source).toContain("pixResumePayload");
  });
});
