/**
 * Mensagem de WhatsApp aberta pelo painel (link wa.me, sem API paga).
 * Reserva confirmada e ainda por vir vira lembrete com serviço, dia, horário e valores;
 * o resto (pendente, cancelada, passada) abre só um cumprimento, como antes.
 */
export type BookingWhatsappInput = {
  customerName: string;
  customerPhone: string;
  businessName: string;
  serviceName: string;
  /** Rótulo longo do dia, ex.: "sábado, 17 de outubro". */
  dayLabel: string;
  start: string;
  status: "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";
  upcoming: boolean;
  hasDeposit: boolean;
  deposit: string;
  remaining: string;
  /** Valor restante em centavos; zero significa que o serviço já está todo pago. */
  remainingCents: number;
};

export type BookingWhatsapp = { kind: "reminder" | "greeting"; text: string; url: string };

export function whatsappDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

const capitalize = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase());

export function bookingWhatsappText(input: BookingWhatsappInput): { kind: BookingWhatsapp["kind"]; text: string } {
  const name = firstName(input.customerName);
  const hello = name ? `Olá, ${name}!` : "Olá!";
  if (input.status !== "confirmed" || !input.upcoming) {
    return { kind: "greeting", text: `${hello} Aqui é ${input.businessName}.` };
  }
  const payment = input.remainingCents <= 0
    ? "Está tudo pago."
    : input.hasDeposit
      ? `Seu sinal de ${input.deposit} já está pago. No atendimento ficam ${input.remaining}.`
      : `No atendimento: ${input.remaining}.`;
  const text = [
    `${hello} Passando para lembrar do seu horário em ${input.businessName}:`,
    "",
    `${input.serviceName}`,
    `${capitalize(input.dayLabel)}, às ${input.start}`,
    "",
    payment,
    "",
    "Qualquer imprevisto, me avise por aqui. Até lá!",
  ].join("\n");
  return { kind: "reminder", text };
}

export function bookingWhatsapp(input: BookingWhatsappInput): BookingWhatsapp {
  const { kind, text } = bookingWhatsappText(input);
  return { kind, text, url: `https://wa.me/${whatsappDigits(input.customerPhone)}?text=${encodeURIComponent(text)}` };
}
