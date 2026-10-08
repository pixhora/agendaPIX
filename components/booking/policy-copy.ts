/** Espelho de `CREDIT_VALIDITY_DAYS` em `lib/policy/text.ts` @ bb1aa96. Este branch ainda não importa esse módulo. */
export const CREDIT_VALIDITY_DAYS = 60;

/** Trecho de crédito sem o nome do negócio. As frases do cliente reaproveitam isto. */
export const CREDIT_PHRASE = `crédito para outro horário, válido por ${CREDIT_VALIDITY_DAYS} dias`;

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
    ? `Mais perto da hora, o sinal vira ${CREDIT_PHRASE}.`
    : `Mais perto da hora, o sinal fica com ${businessName}.`;
  return `${head} ${tail}`;
}

export function policyWindowBody(businessName: string): string {
  return `Cancele e ${businessName} pode devolver o sinal, ou remarque usando o sinal (1 vez).`;
}

/** Linha "Depois disso" da folha. Espelha `policyDetails` do backend. */
export function policyLateCancelDetail(businessName: string, late: "keep" | "credit" = "keep"): string {
  if (late === "credit") {
    return `Se cancelar, o sinal vira crédito para outro horário em ${businessName}, válido por ${CREDIT_VALIDITY_DAYS} dias.`;
  }
  return `Se cancelar, o sinal fica com ${businessName}.`;
}

export function policyNoShowRefund(businessName: string): string {
  return `${businessName} pode devolver o sinal.`;
}

/** "Se faltar" quando o sinal vira crédito. Sem o nome do negócio, como na spec 06. */
export function policyNoShowCredit(): string {
  return `O sinal vira ${CREDIT_PHRASE}.`;
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

/** Reserva feita com menos de {h} h para o horário. Sem data, porque o prazo já passou. */
export function policyLateBookingNotice(hours: number): string {
  return closedWindowLine({ refundUntilHours: hours, lateCancel: "retain" });
}

function referenceAt(context: { bookedAt?: Date; now?: Date }) {
  return context.bookedAt ?? context.now ?? new Date();
}

/** Igual a `refundWindowClosedAtBooking` do backend: a reserva já nasceu dentro da janela. */
export function refundWindowClosedAtBooking(
  policy: { refundUntilHours?: number | null },
  startsAt: Date,
  bookedAt: Date,
): boolean {
  return policy.refundUntilHours != null && bookedAt.getTime() >= startsAt.getTime() - policy.refundUntilHours * 3_600_000;
}

/** Linha da folha e do resumo quando a janela já fechou. Byte a byte com `closedWindowLine`. */
export function closedWindowLine(policy: { refundUntilHours?: number | null; lateCancel?: "retain" | "credit" | null }): string {
  const hours = policy.refundUntilHours ?? 0;
  if (policy.lateCancel === "credit") return `Faltam menos de ${hours} h para o horário: se cancelar, o sinal vira ${CREDIT_PHRASE}.`;
  return `Faltam menos de ${hours} h para o horário: se cancelar, o sinal não é devolvido.`;
}

/** Comprovante e calendário quando a janela já fechou. Byte a byte com `closedWindowReceipt`. */
export function closedWindowReceipt(policy: { lateCancel?: "retain" | "credit" | null }): string {
  if (policy.lateCancel === "credit") return `Se cancelar, o sinal vira ${CREDIT_PHRASE}.`;
  return "Este sinal não é devolvido se cancelar.";
}

/** `true` enquanto `now` é estritamente anterior ao prazo. Igual ao `beforeDeadline` do backend. */
export function isBeforeRefundDeadline(startsAt: Date, hours: number, now: Date): boolean {
  return now.getTime() < startsAt.getTime() - hours * 3_600_000;
}

export interface CustomerPolicyLine {
  title: string;
  body: string;
  tone: "ok" | "warn";
}

/** Espelho local de `policySummary` + `policyDetails` para o preview. */
export function mirrorCustomerPolicy(input: {
  businessName: string;
  hours: number;
  startsAt: Date;
  /** Antes de pagar, passe `now` ou omita. `bookedAt` é o `createdAt` da reserva já feita. */
  now?: Date;
  bookedAt?: Date;
  hasContact?: boolean;
  late?: "keep" | "credit";
  noShow?: "refund" | "credit" | "retain";
}): {
  tone: "ok" | "warn";
  summary: string;
  details: CustomerPolicyLine[];
  refundDeadlineAt: string;
} {
  const reference = referenceAt(input);
  const late = input.late ?? "keep";
  const lateCancel = late === "credit" ? "credit" : "retain";
  const closed = refundWindowClosedAtBooking({ refundUntilHours: input.hours }, input.startsAt, reference);
  const deadline = new Date(input.startsAt.getTime() - input.hours * 3_600_000);
  const noShow = input.noShow ?? "refund";
  const noShowBody = noShow === "credit"
    ? policyNoShowCredit()
    : noShow === "retain"
      ? `O sinal fica com ${input.businessName}.`
      : policyNoShowRefund(input.businessName);
  const closedLine = closedWindowLine({ refundUntilHours: input.hours, lateCancel });
  const first: CustomerPolicyLine = closed
    ? { title: "Perto do horário", body: closedLine, tone: "warn" }
    : { title: formatPolicyWindowTitle(deadline), body: policyWindowBody(input.businessName), tone: "ok" };
  return {
    tone: closed ? "warn" : "ok",
    summary: closed ? closedLine : policyOneLiner(input.businessName, input.hours, late),
    details: [
      first,
      { title: "Depois disso", body: policyLateCancelDetail(input.businessName, late), tone: late === "keep" ? "warn" : "ok" },
      { title: "Se faltar", body: noShowBody, tone: noShow === "retain" ? "warn" : "ok" },
      { title: "Como cancelar ou remarcar", body: policyHowToChange(input.businessName, input.hasContact !== false), tone: "ok" },
    ],
    refundDeadlineAt: deadline.toISOString(),
  };
}

/** Data de devolução do comprovante local. Prazo vencido não vira frase: isso chega em `policy.text`. */
export function receiptRefundCopy(input: {
  businessName: string;
  refundDeadlineAt: string | null | undefined;
  dateLabel: string;
  timeLabel: string;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const deadline = input.refundDeadlineAt ? new Date(input.refundDeadlineAt).getTime() : Number.NaN;
  if (Number.isNaN(deadline) || now.getTime() >= deadline) return null;
  return policyReceiptRefund(input.businessName, input.dateLabel, input.timeLabel);
}

/** O comprovante mostra `policy.text` como chegou. Sem esse campo, usa a data só se ela ainda estiver no futuro. */
export function confirmationPolicyText(policyText: string | null | undefined, datedFallback: string | null): string | null {
  const incoming = policyText?.trim();
  return incoming ? incoming : datedFallback;
}

/** Tom do cartão. Vem de `policy.refundWindowClosedAtBooking`. */
export function confirmationCardTone(refundWindowClosedAtBooking = false): "ok" | "warn" {
  return refundWindowClosedAtBooking ? "warn" : "ok";
}

export function isFutureInstant(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && now.getTime() < time;
}
