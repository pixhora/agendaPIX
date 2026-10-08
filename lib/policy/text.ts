import type { DepositPolicy } from "./schema";

export type PolicySummaryContext = {
  depositCents: number;
  startsAt?: Date;
  now?: Date;
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

function beforeDeadline(startsAt: Date, hours: number, now: Date) {
  return now.getTime() < startsAt.getTime() - hours * 60 * 60 * 1000;
}

function creditSentence(businessName: string) {
  return `o sinal vira crédito por 60 dias em ${businessName}`;
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
    return `Mais perto da hora, o sinal vira crédito para outro horário, válido por ${policy.creditValidityDays} dias.`;
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

function creditDetail(policy: DepositPolicy, businessName: string) {
  return `crédito para outro horário em ${businessName}, válido por ${policy.creditValidityDays} dias`;
}

function receiptSentence(policy: DepositPolicy, context: { businessName: string; startsAt?: Date; timezone?: string }) {
  if (policy.refundUntilHours === null || !context.startsAt) return "";
  const deadline = new Date(context.startsAt.getTime() - policy.refundUntilHours * 3_600_000);
  const { data, hora } = deadlineParts(deadline, context.timezone ?? "America/Sao_Paulo");
  return `${context.businessName} pode devolver o sinal até ${data}, às ${hora}.`;
}

export function policySummary(policy: DepositPolicy, context: PolicySummaryContext): string {
  if (context.depositCents <= 0) return "Sem sinal.";
  const now = context.now ?? new Date();
  if (context.startsAt && policy.refundUntilHours !== null && !beforeDeadline(context.startsAt, policy.refundUntilHours, now)) {
    return `Faltam menos de ${policy.refundUntilHours} h para o horário: se cancelar, o sinal não é devolvido.`;
  }
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
  const now = context.now ?? new Date();
  const refundHours = policy.refundUntilHours;
  const rescheduleHours = policy.rescheduleUntilHours;
  const insideRefundWindow = Boolean(context.startsAt && refundHours !== null && !beforeDeadline(context.startsAt, refundHours, now));
  const hours = refundHours ?? rescheduleHours;
  let title = "Dentro do prazo";
  if (hours !== null && context.startsAt) {
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
    { title, body: withinDeadlineBody(policy, context.businessName), tone: insideRefundWindow ? "warn" : "ok" },
    {
      title: "Depois disso",
      body: policy.lateCancel === "credit"
        ? `Se cancelar, o sinal vira ${creditDetail(policy, context.businessName)}.`
        : `Se cancelar, o sinal fica com ${context.businessName}.`,
      tone: policy.lateCancel === "retain" ? "warn" : "ok",
    },
    {
      title: "Se faltar",
      body: policy.noShow === "refund"
        ? `${context.businessName} pode devolver o sinal.`
        : policy.noShow === "credit"
          ? `O sinal vira ${creditDetail(policy, context.businessName)}.`
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
  const receipt = receiptSentence(policy, context);
  if (receipt) return receipt;
  if (policy.refundUntilHours !== null) return refundWindowSummary(policy, context.businessName);
  return [windowSentence(policy), outcomeSentence(policy, context.businessName)].filter(Boolean).join(" ");
}
