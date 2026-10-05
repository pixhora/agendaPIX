import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingStatus } from "../../components/dashboard/booking-status";

describe("status da reserva na agenda", () => {
  it("preserva o estado pendente mesmo após o prazo do sinal", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
      expect(renderToStaticMarkup(BookingStatus({ status: "pending_payment" })).replace(/<[^>]*>/g, "")).toBe("Aguardando sinal");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["confirmed", "Confirmado"],
    ["cancelled", "Cancelado"],
    ["expired", "Prazo do sinal encerrado"],
    ["completed", "Concluído"],
  ] as const)("apresenta o estado %s recebido do servidor", (status, label) => {
    expect(renderToStaticMarkup(BookingStatus({ status })).replace(/<[^>]*>/g, "")).toBe(label);
  });
});
