const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Título curto da folha: "Até qua, 07 out, 11:30". */
export function formatPolicyWindowTitle(date: Date, timezone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = WEEKDAYS[WEEKDAY_INDEX[read("weekday")] ?? 0];
  const month = MONTHS[Math.max(0, Number(read("month")) - 1)] ?? "";
  return `Até ${weekday}, ${read("day")} ${month}, ${read("hour")}:${read("minute")}`;
}

/** Uma linha antes de pagar. Sem artigo antes do nome do negócio. */
export function policyOneLiner(businessName: string, hours: number, late: "keep" | "credit" = "keep"): string {
  const head = `Com ${hours} h de antecedência, ${businessName} pode devolver o sinal.`;
  const tail = late === "credit"
    ? "Mais perto da hora, o sinal vira crédito para outro horário, válido por 60 dias."
    : `Mais perto da hora, o sinal fica com ${businessName}.`;
  return `${head} ${tail}`;
}

export function policyWindowBody(businessName: string): string {
  return `Cancele e ${businessName} pode devolver o sinal, ou remarque usando o sinal (1 vez).`;
}

/** Linha "Depois disso" da folha. Espelha `policyDetails` do backend. */
export function policyLateCancelDetail(businessName: string, late: "keep" | "credit" = "keep"): string {
  if (late === "credit") {
    return `Se cancelar, o sinal vira crédito para outro horário em ${businessName}, válido por 60 dias.`;
  }
  return `Se cancelar, o sinal fica com ${businessName}.`;
}

export function policyNoShowRefund(businessName: string): string {
  return `${businessName} pode devolver o sinal.`;
}

export function policyHowToChange(businessName: string, hasContact: boolean): string {
  const start = hasContact
    ? `Fale com ${businessName} pelo WhatsApp.`
    : `Fale com ${businessName} pelos canais de sempre.`;
  return `${start} A devolução não é automática: quem devolve é ${businessName}, da conta Mercado Pago do negócio, depois de confirmar o cancelamento.`;
}

export function policyReceiptRefund(businessName: string, date: string, time: string): string {
  return `${businessName} pode devolver o sinal até ${date}, às ${time}.`;
}
