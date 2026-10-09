import { describe, expect, it } from "vitest";
import { buildPublicBookingBody, publicBookingSession, stripStoredBookingCpf } from "../../components/booking/booking-payload";

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

  it("envia o CPF só quando o servidor exige e não manda policyHash sem política", () => {
    expect(buildPublicBookingBody({
      service: { id: service.id, depositCents: 2500 },
      startsAt: "2030-01-01T15:00:00.000Z",
      name: "Ana",
      phone: "+5511987654321",
      cpfDigits: "52998224725",
      requiresPayerCpf: true,
    })).toEqual({
      serviceId: service.id,
      startsAt: "2030-01-01T15:00:00.000Z",
      customer: { name: "Ana", phone: "+5511987654321", cpfCnpj: "52998224725" },
    });
  });

  it("não manda CPF quando a flag vem ausente", () => {
    expect(buildPublicBookingBody({
      service: { id: service.id, depositCents: 0 },
      startsAt: "2030-01-01T15:00:00.000Z",
      name: "Ana",
      phone: "+5511987654321",
      cpfDigits: "52998224725",
    }).customer).toEqual({ name: "Ana", phone: "+5511987654321" });
  });

  it("a sessão do navegador não guarda CPF e apaga um valor antigo", () => {
    const session = publicBookingSession({
      bookingId: "b1",
      accessToken: "tok",
      serviceId: service.id,
      customerName: "Ana",
      customerPhone: "11987654321",
      expiresAt: "2030-01-01T15:30:00.000Z",
    });
    expect(JSON.stringify(session)).not.toContain("cpf");
    const stripped = stripStoredBookingCpf({ ...session, customerCpf: "529.982.247-25" });
    expect(stripped.hadCpf).toBe(true);
    expect(stripped.record).not.toHaveProperty("customerCpf");
    expect(stripStoredBookingCpf(session).hadCpf).toBe(false);
  });
});
