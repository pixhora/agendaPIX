// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PausedState } from "@/components/booking/PausedState";
import { BOOKINGS_PAUSED_COPY } from "@/components/booking/customer-copy";

const service = {
  id: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b",
  name: "Corte",
  durationMinutes: 30,
  priceCents: 8000,
  depositCents: 2000,
};

afterEach(() => {
  cleanup();
});

describe("agenda pausada na página pública", () => {
  it("mostra a frase da pausa e abre o WhatsApp da loja", () => {
    render(<PausedState businessName="Salao da Ana" contactWhatsapp="+5511988887777" services={[service]} />);
    expect(screen.getByRole("heading", { name: BOOKINGS_PAUSED_COPY })).toBeVisible();
    const talk = screen.getByRole("link", { name: "Falar com a loja" });
    expect(talk).toHaveAttribute("href", "https://wa.me/5511988887777");
    expect(talk.className).toMatch(/bg-pix-deep/);
    expect(talk).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Já agendou? Seu comprovante continua valendo.")).toBeVisible();
    expect(screen.queryByText(/assinatura|teste grátis|pagamento do dono|Chamar no WhatsApp|Agendamento online pausado/i)).toBeNull();
  });

  it("sem WhatsApp não inventa botão de contato", () => {
    render(<PausedState businessName="Salao da Ana" contactWhatsapp={null} services={[]} />);
    expect(screen.getByRole("heading", { name: BOOKINGS_PAUSED_COPY })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Falar com a loja" })).toBeNull();
    expect(screen.getByText("Fale com Salao da Ana pelos canais de sempre.")).toBeVisible();
  });
});
