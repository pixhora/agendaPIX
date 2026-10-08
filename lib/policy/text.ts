import { CREDIT_VALIDITY_DAYS, type DepositPolicy } from "./schema";

/** Trecho de crédito sem o nome do negócio. As frases do cliente reaproveitam isto. */
export const CREDIT_PHRASE = `crédito para outro horário, válido por ${CREDIT_VALIDITY_DAYS} dias`;

export type PolicySummaryContext = {
  depositCents: number;
  startsAt?: Date;
  now?: Date;
  bookedAt?: Date;
  businessName?: string;
};

export type PolicyDetailLine = {
  title: string;
  body: string;
  tone: "ok" | "warn";
};

export type PolicyDetailsContext = {
  businessName: string;
  contactWhatsapp: string | null;
  startsAt?: Date;
  now?: Date;
  bookedAt?: Date;
  timezone?: string;
};

export type OwnerPreviewContext = {
  businessName: string;
  depositCents: number;
};

export type PolicyIcsContext = {
  businessName: string;
  depositCents: number;
  startsAt?: Date;
  now?: Date;
  bookedAt?: Date;
  timezone?: string;
};

const SHORT_WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

function formatMoney(cents: number) {
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100).toLocaleString("pt-BR");
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}R$ ${whole},${fraction}`;
}

function partsInZone(date: Date, timezone: string) {
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
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[read("weekday")] ?? 0;
  return { weekday, day: read("day"), month: read("month"), hour: read("hour"), minute: read("minute") };
}

function deadlineParts(date: Date, timezone: string) {
  const parts = partsInZone(date, timezone);
  const month = SHORT_MONTHS[Number(parts.month) - 1] ?? "";
  return {
    data: `${SHORT_WEEKDAYS[parts.weekday]}, ${parts.day} ${month}`,
    hora: `${parts.hour}:${parts.minute}`,
  };
}

function creditSentence(businessName: string) {
  return `o sinal vira crédito por ${CREDIT_VALIDITY_DAYS} dias em ${businessName}`;
}

function referenceAt(context: { bookedAt?: Date; now?: Date }) {
  return context.bookedAt ?? context.now ?? new Date();
}

export function refundWindowClosedAtBooking(policy: DepositPolicy, startsAt: Date, bookedAt: Date) {
  return policy.refundUntilHours !== null && bookedAt.getTime() >= startsAt.getTime() - policy.refundUntilHours * 3_600_000;
}

function windowClosed(policy: DepositPolicy, context: { startsAt?: Date; bookedAt?: Date; now?: Date }) {
  return Boolean(context.startsAt && refundWindowClosedAtBooking(policy, context.startsAt, referenceAt(context)));
}

function closedWindowLine(policy: DepositPolicy) {
  const hours = policy.refundUntilHours ?? 0;
  if (policy.lateCancel === "credit") return `Faltam menos de ${hours} h para o horário: se cancelar, o sinal vira ${CREDIT_PHRASE}.`;
  return `Faltam menos de ${hours} h para o horário: se cancelar, o sinal não é devolvido.`;
}

function closedWindowReceipt(policy: DepositPolicy) {
  if (policy.lateCancel === "credit") return `Se cancelar, o sinal vira ${CREDIT_PHRASE}.`;
  return "Este sinal não é devolvido se cancelar.";
}

function refundByBusiness(businessName: string) {
  return `${businessName} devolve pelo AgendaPix, conforme a política, se confirmar no painel`;
}

function outcomePhrase(kind: DepositPolicy["lateCancel"] | DepositPolicy["noShow"], businessName: string) {
  if (kind === "credit") return creditSentence(businessName);
  if (kind === "refund") return "cabe a devolução";
  return `o sinal fica com ${businessName}`;
}

function windowSentence(policy: DepositPolicy) {
  const refund = policy.refundUntilHours;
  const reschedule = policy.rescheduleUntilHours;
  if (refund !== null && reschedule !== null && refund === reschedule) return `Cancele ou remarque até ${refund} h antes.`;
  if (refund !== null && reschedule !== null) return `Cancele até ${refund} h antes ou remarque até ${reschedule} h antes.`;
  if (refund !== null) return `Cancele até ${refund} h antes. Não dá para remarcar usando o sinal.`;
  if (reschedule !== null) return `O sinal não é devolvido. Dá para remarcar até ${reschedule} h antes usando o sinal.`;
  return "O sinal não é devolvido nem remarcado.";
}

function refundNote(policy: DepositPolicy, businessName: string) {
  return mentionsRefund(policy) ? `${refundByBusiness(businessName)}.` : "";
}

function outcomeSentence(policy: DepositPolicy, businessName: string) {
  const same = policy.lateCancel === policy.noShow;
  const hasWindow = policy.refundUntilHours !== null || policy.rescheduleUntilHours !== null;
  if (same && hasWindow) return `Depois disso, ou se faltar, ${outcomePhrase(policy.lateCancel, businessName)}.`;
  if (same) return `Se cancelar ou faltar, ${outcomePhrase(policy.lateCancel, businessName)}.`;
  const lateLead = hasWindow ? "Se cancelar depois do prazo" : "Se cancelar";
  return `${lateLead}, ${outcomePhrase(policy.lateCancel, businessName)}. Se faltar, ${outcomePhrase(policy.noShow, businessName)}.`;
}

function mentionsRefund(policy: DepositPolicy) {
  return policy.refundUntilHours !== null || policy.noShow === "refund";
}

function closerToTime(policy: DepositPolicy, businessName: string) {
  if (policy.lateCancel === "credit") {
    return `Mais perto da hora, o sinal vira ${CREDIT_PHRASE}.`;
  }
  return `Mais perto da hora, o sinal fica com ${businessName}.`;
}

function refundWindowSummary(policy: DepositPolicy, businessName: string) {
  const hours = policy.refundUntilHours;
  if (hours === null) return "";
  return `Com ${hours} h de antecedência, ${businessName} pode devolver o sinal. ${closerToTime(policy, businessName)}`;
}

function rescheduleCountLabel(count: number) {
  return count === 1 ? "1 vez" : `${count} vezes`;
}

function withinDeadlineBody(policy: DepositPolicy, businessName: string) {
  const refund = policy.refundUntilHours !== null;
  const reschedule = policy.rescheduleUntilHours !== null;
  const times = `(${rescheduleCountLabel(policy.maxReschedules)})`;
  if (refund && reschedule) return `Cancele e ${businessName} pode devolver o sinal, ou remarque usando o sinal ${times}.`;
  if (refund) return `Cancele e ${businessName} pode devolver o sinal.`;
  if (reschedule) return `Remarque usando o sinal ${times}. O sinal não é devolvido.`;
  return "O sinal não é devolvido nem remarcado.";
}

function creditDetail(businessName: string) {
  return `crédito para outro horário em ${businessName}, válido por ${CREDIT_VALIDITY_DAYS} dias`;
}

function receiptSentence(policy: DepositPolicy, context: { businessName: string; startsAt?: Date; timezone?: string; bookedAt?: Date; now?: Date }) {
  if (policy.refundUntilHours === null || !context.startsAt || windowClosed(policy, context)) return "";
  const deadline = new Date(context.startsAt.getTime() - policy.refundUntilHours * 3_600_000);
  const { data, hora } = deadlineParts(deadline, context.timezone ?? "America/Sao_Paulo");
  return `${context.businessName} pode devolver o sinal até ${data}, às ${hora}.`;
}

export function policySummary(policy: DepositPolicy, context: PolicySummaryContext): string {
  if (context.depositCents <= 0) return "Sem sinal.";
  if (windowClosed(policy, context)) return closedWindowLine(policy);
  if (policy.refundUntilHours !== null) return refundWindowSummary(policy, context.businessName ?? "");
  if (policy.rescheduleUntilHours !== null) return `O sinal não é devolvido, mas dá para remarcar até ${policy.rescheduleUntilHours} h antes.`;
  return "O sinal não é devolvido nem remarcado.";
}

export function policyListLabel(policy: DepositPolicy, depositCents: number): string {
  if (depositCents <= 0) return "Sem sinal";
  if (policy.refundUntilHours !== null) return `Até ${policy.refundUntilHours} h, conforme a política`;
  if (policy.rescheduleUntilHours !== null) return `Não devolve · remarca até ${policy.rescheduleUntilHours} h`;
  return "Não devolve nem remarca";
}

export function policyDetails(policy: DepositPolicy, context: PolicyDetailsContext): PolicyDetailLine[] {
  const timezone = context.timezone ?? "America/Sao_Paulo";
  const refundHours = policy.refundUntilHours;
  const rescheduleHours = policy.rescheduleUntilHours;
  const closed = windowClosed(policy, context);
  const hours = refundHours ?? rescheduleHours;
  let title = "Dentro do prazo";
  let windowBody = withinDeadlineBody(policy, context.businessName);
  if (closed) {
    title = "Perto do horário";
    windowBody = closedWindowLine(policy);
  } else if (hours !== null && context.startsAt) {
    const deadline = new Date(context.startsAt.getTime() - hours * 3_600_000);
    const { data, hora } = deadlineParts(deadline, timezone);
    title = `Até ${data}, ${hora}`;
  } else if (hours !== null) {
    title = `Até ${hours} h antes`;
  }

  const contact = context.contactWhatsapp
    ? `Fale com ${context.businessName} pelo WhatsApp.`
    : `Fale com ${context.businessName} pelos canais de sempre.`;
  const refundHow = `A devolução não é automática: quem devolve é ${context.businessName}, da conta Mercado Pago do negócio, depois de confirmar o cancelamento.`;

  return [
    { title, body: windowBody, tone: closed ? "warn" : "ok" },
    {
      title: "Depois disso",
      body: policy.lateCancel === "credit"
        ? `Se cancelar, o sinal vira ${creditDetail(context.businessName)}.`
        : `Se cancelar, o sinal fica com ${context.businessName}.`,
      tone: policy.lateCancel === "retain" ? "warn" : "ok",
    },
    {
      title: "Se faltar",
      body: policy.noShow === "refund"
        ? `${context.businessName} pode devolver o sinal.`
        : policy.noShow === "credit"
          ? `O sinal vira ${CREDIT_PHRASE}.`
          : `O sinal fica com ${context.businessName}.`,
      tone: policy.noShow === "retain" ? "warn" : "ok",
    },
    {
      title: "Como cancelar ou remarcar",
      body: mentionsRefund(policy) ? `${contact} ${refundHow}` : `${contact} Neste caso o sinal não é devolvido.`,
      tone: "ok",
    },
  ];
}

export function ownerPreview(policy: DepositPolicy, context: OwnerPreviewContext): string {
  if (context.depositCents <= 0) return "Sem sinal: a reserva confirma na hora, sem Pix.";
  return [
    `Sinal de ${formatMoney(context.depositCents)} no Pix para reservar.`,
    windowSentence(policy),
    outcomeSentence(policy, context.businessName),
    refundNote(policy, context.businessName),
  ].filter(Boolean).join(" ");
}

export function policyIcsText(policy: DepositPolicy, context: PolicyIcsContext): string {
  if (context.depositCents <= 0) return "";
  if (windowClosed(policy, context)) return closedWindowReceipt(policy);
  const receipt = receiptSentence(policy, context);
  if (receipt) return receipt;
  if (policy.refundUntilHours !== null) return refundWindowSummary(policy, context.businessName);
  return [windowSentence(policy), outcomeSentence(policy, context.businessName)].filter(Boolean).join(" ");
}

export type ClientPolicyTextContext = PolicyDetailsContext & {
  depositCents: number;
};

/** Texto gravado em `policy.text` e lido pelo cliente. A prévia do dono não entra aqui. */
export function clientPolicyText(policy: DepositPolicy, context: ClientPolicyTextContext): string {
  if (context.depositCents <= 0) return "";
  const receipt = policy.refundUntilHours !== null && context.startsAt ? policyIcsText(policy, context) : "";
  const details = policyDetails(policy, context).map((line) => line.body);
  return [receipt, ...details].filter((part) => part.length > 0).join(" ");
}
