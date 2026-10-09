import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookingIdempotencyPayload, bookingRequestHash, hash } from "../../lib/bookings/service";

const base = {
  serviceId: "550e8400-e29b-41d4-a716-446655440000",
  startsAt: "2030-01-01T12:00:00.000Z",
  customer: { name: "Ana", phone: "+5511999999999" },
  policyHash: "ab".repeat(32),
};

describe("hash da reserva sem CPF", () => {
  it("ignora o CPF e continua distinguindo o resto do pedido", () => {
    const withCpf = { ...base, customer: { ...base.customer, cpfCnpj: "52998224725" } };
    const otherCpf = { ...base, customer: { ...base.customer, cpfCnpj: "39053344705" } };
    expect(bookingRequestHash(withCpf)).toBe(bookingRequestHash(base));
    expect(bookingRequestHash(otherCpf)).toBe(bookingRequestHash(base));
    expect(JSON.stringify(bookingIdempotencyPayload(withCpf))).not.toContain("52998224725");
    expect(bookingRequestHash(withCpf)).not.toBe(hash(JSON.stringify(withCpf)));
    expect(bookingRequestHash({ ...base, customer: { ...base.customer, name: "Bia" } })).not.toBe(bookingRequestHash(base));
    expect(bookingRequestHash({ ...base, customer: { ...base.customer, phone: "+5511888888888" } })).not.toBe(bookingRequestHash(base));
    expect(bookingRequestHash({ ...base, startsAt: "2030-01-01T12:30:00.000Z" })).not.toBe(bookingRequestHash(base));
  });

  it("a página pública não grava o CPF no sessionStorage", () => {
    const source = readFileSync("components/booking/BookingFlow.tsx", "utf8");
    expect(source).not.toContain("customerCpf:");
    expect(source).not.toContain("stored?.customerCpf");
    expect(source).not.toContain("stored.customerCpf");
  });
});
