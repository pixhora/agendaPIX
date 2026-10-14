import { describe, expect, it } from "vitest";
import { bookingWhatsapp, bookingWhatsappText, firstName, whatsappDigits, type BookingWhatsappInput } from "../../lib/dashboard/whatsapp-reminder";

const base: BookingWhatsappInput = {
  customerName: "Ana Souza Lima",
  customerPhone: "+5511999990000",
  businessName: "Studio Bella",
  serviceName: "Corte feminino",
  dayLabel: "sábado, 17 de outubro",
  start: "11:30",
  status: "confirmed",
  upcoming: true,
  hasDeposit: true,
  deposit: "R$ 40,00",
  remaining: "R$ 80,00",
  remainingCents: 8000,
};

describe("lembrete de WhatsApp da reserva", () => {
  it("reserva confirmada e futura vira lembrete com serviço, dia, horário e valores", () => {
    const { kind, text } = bookingWhatsappText(base);
    expect(kind).toBe("reminder");
    expect(text).toBe([
      "Olá, Ana! Passando para lembrar do seu horário em Studio Bella:",
      "",
      "Corte feminino",
      "Sábado, 17 de outubro, às 11:30",
      "",
      "Seu sinal de R$ 40,00 já está pago. No atendimento ficam R$ 80,00.",
      "",
      "Qualquer imprevisto, me avise por aqui. Até lá!",
    ].join("\n"));
  });

  it("sem sinal mostra só o valor do atendimento; tudo pago não cobra nada", () => {
    expect(bookingWhatsappText({ ...base, hasDeposit: false }).text).toContain("No atendimento: R$ 80,00.");
    const paid = bookingWhatsappText({ ...base, remainingCents: 0, remaining: "R$ 0,00" }).text;
    expect(paid).toContain("Está tudo pago.");
    expect(paid).not.toContain("R$ 0,00");
  });

  it.each([
    ["pending_payment", true],
    ["cancelled", true],
    ["expired", true],
    ["completed", true],
    ["confirmed", false],
  ] as const)("status %s (futura=%s) abre só o cumprimento", (status, upcoming) => {
    const { kind, text } = bookingWhatsappText({ ...base, status, upcoming });
    expect(kind).toBe("greeting");
    expect(text).toBe("Olá, Ana! Aqui é Studio Bella.");
  });

  it("monta o link wa.me só com dígitos e o texto codificado", () => {
    const { url, text } = bookingWhatsapp(base);
    expect(url.startsWith("https://wa.me/5511999990000?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(text);
  });

  it("helpers lidam com espaços e formatação", () => {
    expect(whatsappDigits("+55 (11) 99999-0000")).toBe("5511999990000");
    expect(firstName("  Bia  ")).toBe("Bia");
    expect(bookingWhatsappText({ ...base, customerName: "   " }).text.startsWith("Olá! Passando")).toBe(true);
  });
});
