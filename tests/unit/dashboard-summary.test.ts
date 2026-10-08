import { describe, expect, it } from "vitest";
import type { DashboardBooking } from "../../lib/dashboard/data";
import { dashboardAgendaKpis, dashboardAgendaSummary, formatBrlCents } from "../../lib/dashboard/summary";

const booking = (overrides: Partial<DashboardBooking>): DashboardBooking => ({
  id: "booking-1",
  startsAt: new Date("2030-01-02T14:00:00.000Z"),
  endsAt: new Date("2030-01-02T14:30:00.000Z"),
  status: "confirmed",
  expiresAt: null,
  priceCents: 5000,
  depositCents: 1200,
  serviceName: "Corte",
  customerName: "Cliente de teste",
  customerPhone: "+5511999990000",
  refundStatus: null,
  refundedAt: null,
  manualRefundDueAt: null,
  manualRefundOverdue: false,
  manualRefundDueTomorrow: false,
  ...overrides,
});

describe("dashboard agenda summary", () => {
  it("soma apenas sinais positivos confirmados no dia local selecionado", () => {
    const rows = [
      booking({ id: "confirmed-morning", depositCents: 1200 }),
      booking({ id: "confirmed-night", startsAt: new Date("2030-01-03T02:30:00.000Z"), depositCents: 3400 }),
      booking({ id: "next-local-day", startsAt: new Date("2030-01-03T03:30:00.000Z"), depositCents: 1000 }),
      booking({ id: "pending", status: "pending_payment", depositCents: 2000 }),
      booking({ id: "no-deposit", depositCents: 0 }),
    ];

    const summary = dashboardAgendaSummary(rows, "2030-01-02", "America/Sao_Paulo", new Date("2030-01-02T12:00:00.000Z"));

    expect(summary.confirmedSignalCents).toBe(4600n);
    expect(summary.confirmedSignalCount).toBe(2);
  });

  it("escolhe a reserva futura válida mais próxima e ignora estados encerrados ou expirados", () => {
    const rows = [
      booking({ id: "later", startsAt: new Date("2030-01-02T16:00:00.000Z") }),
      booking({ id: "pending-expired", status: "pending_payment", startsAt: new Date("2030-01-02T12:30:00.000Z"), expiresAt: new Date("2030-01-02T11:59:00.000Z") }),
      booking({ id: "cancelled", status: "cancelled", startsAt: new Date("2030-01-02T12:45:00.000Z") }),
      booking({ id: "pending-valid", status: "pending_payment", startsAt: new Date("2030-01-02T13:00:00.000Z"), expiresAt: new Date("2030-01-02T13:15:00.000Z") }),
    ];

    const summary = dashboardAgendaSummary(rows, "2030-01-02", "America/Sao_Paulo", new Date("2030-01-02T12:00:00.000Z"));

    expect(summary.nextReservation?.id).toBe("pending-valid");
  });

  it("formata centavos inteiros sem converter para ponto flutuante", () => {
    expect(formatBrlCents(123456n)).toBe("R$\u00a01.234,56");
  });
});

describe("dashboard agenda kpis", () => {
  const now = new Date("2030-01-02T12:00:00.000Z");
  it("conta reservas ativas, receita via Pix e pendentes no prazo", () => {
    const kpis = dashboardAgendaKpis([
      booking({ id: "a", status: "confirmed", depositCents: 1500 }),
      booking({ id: "b", status: "completed", depositCents: 1000 }),
      booking({ id: "c", status: "confirmed", depositCents: 0 }),
      booking({ id: "d", status: "pending_payment", depositCents: 800, expiresAt: new Date("2030-01-02T12:10:00.000Z") }),
      booking({ id: "e", status: "pending_payment", depositCents: 800, expiresAt: new Date("2030-01-02T11:50:00.000Z") }),
      booking({ id: "f", status: "cancelled", depositCents: 900 }),
      booking({ id: "g", status: "expired", depositCents: 900 }),
    ], now);
    expect(kpis).toEqual({
      bookingCount: 5,
      confirmedCount: 3,
      pendingCount: 1,
      pendingSignalCents: 800n,
      pixRevenueCents: 2500n,
      pixRevenueCount: 2,
    });
  });
  it("retorna zeros sem reservas", () => {
    expect(dashboardAgendaKpis([], now)).toMatchObject({ bookingCount: 0, pendingCount: 0, pixRevenueCents: 0n });
  });
});
