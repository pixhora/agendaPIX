import { describe, expect, it } from "vitest";
import { buildPublicBookingBody } from "../../components/booking/booking-payload";

const service = {
  id: "11111111-1111-4111-8111-111111111111",
  depositCents: 2500,
  policySummary: "O estabelecimento pode devolver o sinal com 24 horas de antecedência.",
  policyHash: "hash-1",
};

describe("corpo do agendamento público", () => {
  it("omite o CPF quando o servidor manda requiresPayerCpf false e envia o hash da política", () => {
    expect(buildPublicBookingBody({
      service,
      startsAt: "2030-01-01T15:00:00.000Z",
      name: "Ana",
      phone: "+5511987654321",
      cpfDigits: "52998224725",
      requiresPayerCpf: false,
    })).toEqual({
      serviceId: service.id,
      startsAt: "2030-01-01T15:00:00.000Z",
      customer: { name: "Ana", phone: "+5511987654321" },
      policyHash: "hash-1",
    });
  });

  it("mantém o CPF e não manda policyHash enquanto a API atual não publica a política", () => {
    expect(buildPublicBookingBody({
      service: { id: service.id, depositCents: 2500 },
      startsAt: "2030-01-01T15:00:00.000Z",
      name: "Ana",
      phone: "+5511987654321",
      cpfDigits: "52998224725",
    })).toEqual({
      serviceId: service.id,
      startsAt: "2030-01-01T15:00:00.000Z",
      customer: { name: "Ana", phone: "+5511987654321", cpfCnpj: "52998224725" },
    });
  });
});
