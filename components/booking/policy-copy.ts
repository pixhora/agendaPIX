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

/** "Se faltar" quando o sinal vira crédito. Sem o nome do negócio, como na spec 06. */
export function policyNoShowCredit(): string {
  return "O sinal vira crédito para outro horário, válido por 60 dias.";
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
  return `Faltam menos de ${hours} h para o horário: se cancelar, o sinal não é devolvido.`;
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
  now?: Date;
  hasContact?: boolean;
  late?: "keep" | "credit";
  noShow?: "refund" | "credit" | "retain";
}): {
  tone: "ok" | "warn";
  summary: string;
  details: CustomerPolicyLine[];
  refundDeadlineAt: string;
} {
  const now = input.now ?? new Date();
  const open = isBeforeRefundDeadline(input.startsAt, input.hours, now);
  const deadline = new Date(input.startsAt.getTime() - input.hours * 3_600_000);
  const late = input.late ?? "keep";
  const noShow = input.noShow ?? "refund";
  const noShowBody = noShow === "credit"
    ? policyNoShowCredit()
    : noShow === "retain"
      ? `O sinal fica com ${input.businessName}.`
      : policyNoShowRefund(input.businessName);
  const first: CustomerPolicyLine = open
    ? { title: formatPolicyWindowTitle(deadline), body: policyWindowBody(input.businessName), tone: "ok" }
    : {
        title: `Faltam menos de ${input.hours} h para o horário`,
        body: "Se cancelar, o sinal não é devolvido.",
        tone: "warn",
      };
  return {
    tone: open ? "ok" : "warn",
    summary: open ? policyOneLiner(input.businessName, input.hours, late) : policyLateBookingNotice(input.hours),
    details: [
      first,
      { title: "Depois disso", body: policyLateCancelDetail(input.businessName, late), tone: late === "keep" ? "warn" : "ok" },
      { title: "Se faltar", body: noShowBody, tone: noShow === "retain" ? "warn" : "ok" },
      { title: "Como cancelar ou remarcar", body: policyHowToChange(input.businessName, input.hasContact !== false), tone: "ok" },
    ],
    refundDeadlineAt: deadline.toISOString(),
  };
}

/** Linhas da folha. No caso em cima da hora, some o "Até {data}" e entra o aviso. */
export function policyLinesForCustomer(
  lines: Array<{ title: string; body: string; tone?: "ok" | "warn" }> | null | undefined,
  late: boolean,
  hours: number | null,
): Array<{ title: string; body: string; tone?: "ok" | "warn" }> {
  const source = lines ?? [];
  if (!late) return source;
  const rest = source.filter((line) => !line.title.startsWith("Até "));
  if (hours == null) return rest;
  const notice = policyLateBookingNotice(hours);
  if (rest.some((line) => line.body === notice || `${line.title}: ${line.body.charAt(0).toLowerCase()}${line.body.slice(1)}` === notice)) {
    return rest;
  }
  return [
    {
      title: `Faltam menos de ${hours} h para o horário`,
      body: "Se cancelar, o sinal não é devolvido.",
      tone: "warn",
    },
    ...rest,
  ];
}

/** Comprovante e ICS. Data de devolução só entra se o prazo ainda não chegou. */
export function receiptRefundCopy(input: {
  businessName: string;
  hours: number | null;
  refundDeadlineAt: string | null | undefined;
  dateLabel: string;
  timeLabel: string;
  now?: Date;
}): { tone: "ok" | "warn"; text: string | null } {
  const now = input.now ?? new Date();
  const deadline = input.refundDeadlineAt ? new Date(input.refundDeadlineAt).getTime() : Number.NaN;
  if (!Number.isNaN(deadline) && now.getTime() < deadline) {
    return { tone: "ok", text: policyReceiptRefund(input.businessName, input.dateLabel, input.timeLabel) };
  }
  if (!Number.isNaN(deadline) && input.hours != null) {
    return { tone: "warn", text: policyLateBookingNotice(input.hours) };
  }
  return { tone: "ok", text: null };
}

const OWNER_POLICY_MARK = /\bpainel\b|Devolver pelo AgendaPix/;
const DATED_REFUND_MARK = /pode devolver o sinal até/;

/**
 * Texto do comprovante e do calendário.
 * `policy.text` do #29 em 7e74a59 é o texto do cliente, mas ainda inclui
 * "pode devolver o sinal até {data}" quando a reserva já está dentro do prazo.
 * Nesse caso o front mostra o aviso e esconde a data.
 */
export function confirmationPolicyCopy(input: {
  policyText?: string | null;
  businessName: string;
  hours: number | null;
  refundDeadlineAt?: string | null;
  dateLabel: string;
  timeLabel: string;
  now?: Date;
}): { tone: "ok" | "warn"; text: string | null } {
  const now = input.now ?? new Date();
  const local = receiptRefundCopy({
    businessName: input.businessName,
    hours: input.hours,
    refundDeadlineAt: input.refundDeadlineAt,
    dateLabel: input.dateLabel,
    timeLabel: input.timeLabel,
    now,
  });
  const incoming = input.policyText?.trim() ?? "";
  const safeIncoming = incoming && !OWNER_POLICY_MARK.test(incoming) ? incoming : "";
  const deadline = input.refundDeadlineAt ? new Date(input.refundDeadlineAt).getTime() : Number.NaN;
  const closed = !Number.isNaN(deadline) && now.getTime() >= deadline;
  if (closed) {
    if (safeIncoming && !DATED_REFUND_MARK.test(safeIncoming)) return { tone: "warn", text: safeIncoming };
    return local.tone === "warn" ? local : { tone: "warn", text: null };
  }
  if (safeIncoming) return { tone: "ok", text: safeIncoming };
  return local;
}

export function isFutureInstant(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && now.getTime() < time;
}
