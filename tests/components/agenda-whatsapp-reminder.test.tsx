// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgendaBoard, type AgendaDay, type AgendaItem } from "@/components/dashboard/agenda-board";

const day: AgendaDay = { date: "2030-10-19", label: "sábado, 19 de outubro", weekday: "sáb", dayNumber: "19", isToday: false };
const item = (overrides: Partial<AgendaItem>): AgendaItem => ({
  id: "b1",
  day: day.date,
  start: "11:30",
  end: "12:30",
  customerName: "Ana Souza",
  customerPhone: "+5511999990000",
  serviceName: "Corte feminino",
  status: "confirmed",
  price: "R$ 120,00",
  deposit: "R$ 40,00",
  remaining: "R$ 80,00",
  remainingCents: 8000,
  hasDeposit: true,
  upcoming: true,
  ...overrides,
});

beforeAll(() => {
  // jsdom não implementa <dialog>.showModal/close.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});
afterEach(cleanup);

function openDetail(booking: AgendaItem) {
  render(<AgendaBoard days={[day]} bookings={[booking]} weekly={false} businessName="Studio Bella" />);
  fireEvent.click(screen.getByRole("button", { name: /Ana Souza/ }));
  return screen.getByRole("link", { name: /WhatsApp/ });
}

describe("botão de WhatsApp no detalhe da reserva", () => {
  it("confirmada e futura: 'Lembrar no WhatsApp' com o lembrete completo", () => {
    const link = openDetail(item({}));
    expect(link.textContent).toContain("Lembrar no WhatsApp");
    const text = decodeURIComponent(link.getAttribute("href")!.split("?text=")[1]);
    expect(text).toContain("Sábado, 19 de outubro, às 11:30");
    expect(text).toContain("Seu sinal de R$ 40,00 já está pago");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("aguardando sinal: continua o WhatsApp simples", () => {
    const link = openDetail(item({ status: "pending_payment" }));
    expect(link.textContent).not.toContain("Lembrar");
    expect(decodeURIComponent(link.getAttribute("href")!.split("?text=")[1])).toBe("Olá, Ana! Aqui é Studio Bella.");
  });
});
