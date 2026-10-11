// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { buildAppointmentIcs } from "@/lib/calendar/appointment-ics";
import type { PublicService } from "@/components/booking/types";

const service: PublicService = {
  id: "srv-corte",
  name: "Corte feminino",
  durationMinutes: 45,
  priceCents: 8000,
  depositCents: 2500,
};

const slotEndsAtIgnored = "2026-10-02T21:00:00.000Z";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("botão Adicionar à agenda", () => {
  it("fica abaixo do resumo e baixa o .ics do horário, sem link nem id da reserva", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T15:04:00.000Z"));

    let href = "";
    let download = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function spyClick(this: HTMLAnchorElement) {
      href = this.getAttribute("href") ?? "";
      download = this.download;
    });

    render(
      <BookingConfirmation
        businessName="Studio Bella"
        service={service}
        slot={{ startsAt: "2026-10-02T18:30:00.000Z", endsAt: slotEndsAtIgnored }}
        timezone="America/Sao_Paulo"
        customerName="Juliana Mendes"
        customerPhone="(11) 98888-7777"
        address="Rua das Flores, 10"
        onNewBooking={() => {}}
      />,
    );

    const summary = screen.getByRole("article", { name: "Comprovante do agendamento" });
    const button = screen.getByRole("button", { name: "Adicionar à agenda" });
    expect(summary.nextElementSibling).toBe(button);
    expect(button.className).toContain("h-12");
    expect(button.className).toContain("w-full");
    expect(button.className).toContain("border");
    expect(button.className).toContain("bg-surface");
    expect(button.querySelector("svg.lucide-calendar-plus")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /agenda|calendário/i })).toBeNull();

    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    await user.click(button);

    expect(download).toBe("agenda.ics");
    expect(href.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    const file = decodeURIComponent(href.slice("data:text/calendar;charset=utf-8,".length));
    const expected = buildAppointmentIcs({
      serviceId: service.id,
      serviceName: service.name,
      businessName: "Studio Bella",
      startsAt: "2026-10-02T18:30:00.000Z",
      durationMinutes: 45,
      address: "Rua das Flores, 10",
      now: new Date("2026-10-11T15:04:00.000Z"),
    });
    expect(file).toBe(expected);
    expect(file).toContain("DTSTART:20261002T183000Z");
    expect(file).toContain("DTEND:20261002T191500Z");
    expect(file).not.toContain("DTEND:20261002T210000Z");
    expect(file).not.toContain("Juliana");
    expect(file).not.toContain("98888");
    expect(file).not.toContain("booking");
    expect(file).not.toContain("token");
    expect(file).not.toMatch(/https?:\/\//);
    expect(file.split(/\r\n|\n/).some((line) => line.startsWith("ATTENDEE") || line.startsWith("BEGIN:VALARM"))).toBe(false);
  });
});
