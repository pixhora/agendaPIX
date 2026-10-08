import type { DepositPolicy } from "./schema";

export type PolicySummaryContext = {
  depositCents: number;
  startsAt?: Date;
  now?: Date;
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
};

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

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

function formatWhen(date: Date, timezone: string) {
  const parts = partsInZone(date, timezone);
  return `${WEEKDAYS[parts.weekday]}, ${parts.day}/${parts.month}, ${parts.hour}:${parts.minute}`;
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

export function policySummary(policy: DepositPolicy, context: PolicySummaryContext): string {
  if (context.depositCents <= 0) return "Sem sinal.";
  const now = context.now ?? new Date();
  if (context.startsAt && policy.refundUntilHours !== null && !beforeDeadline(context.startsAt, policy.refundUntilHours, now)) {
    return `Faltam menos de ${policy.refundUntilHours} h para o horário: se cancelar, o sinal não é devolvido.`;
  }
  if (policy.refundUntilHours !== null) return `Se cancelar até ${policy.refundUntilHours} h antes, o negócio faz a devolução conforme a política.`;
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

  let title = "Antes do horário";
  if (refundHours !== null && rescheduleHours !== null && refundHours !== rescheduleHours) {
    title = context.startsAt
      ? `Até ${formatWhen(new Date(context.startsAt.getTime() - refundHours * 3_600_000), timezone)} para devolver e até ${formatWhen(new Date(context.startsAt.getTime() - rescheduleHours * 3_600_000), timezone)} para remarcar`
      : `Até ${refundHours} h antes para devolver e ${rescheduleHours} h antes para remarcar`;
  } else if (refundHours !== null || rescheduleHours !== null) {
    const hours = refundHours ?? rescheduleHours ?? 0;
    title = context.startsAt ? `Até ${formatWhen(new Date(context.startsAt.getTime() - hours * 3_600_000), timezone)}` : `Até ${hours} h antes`;
  }

  const windowBody = refundHours !== null && rescheduleHours !== null
    ? `Cancele no prazo: ${refundByBusiness(context.businessName)}. Ou remarque usando o sinal (1 vez).`
    : refundHours !== null
      ? `Cancele no prazo: ${refundByBusiness(context.businessName)}.`
      : rescheduleHours !== null
        ? "Remarque usando o sinal (1 vez). O sinal não é devolvido."
        : "O sinal não é devolvido nem remarcado.";

  const contact = context.contactWhatsapp
    ? `Fale com ${context.businessName} pelo WhatsApp.`
    : `Fale com ${context.businessName} pelos canais de sempre.`;

  return [
    { title, body: windowBody, tone: insideRefundWindow ? "warn" : "ok" },
    {
      title: "Depois disso",
      body: policy.lateCancel === "credit"
        ? `Se cancelar, o sinal vira crédito para outro horário em ${context.businessName}, válido por 60 dias.`
        : `Se cancelar, o sinal fica com ${context.businessName}.`,
      tone: policy.lateCancel === "retain" ? "warn" : "ok",
    },
    {
      title: "Se faltar",
      body: policy.noShow === "refund"
        ? `${refundByBusiness(context.businessName)}.`
        : policy.noShow === "credit"
          ? `O sinal vira crédito para outro horário em ${context.businessName}, válido por 60 dias.`
          : `O sinal fica com ${context.businessName}.`,
      tone: policy.noShow === "retain" ? "warn" : "ok",
    },
    {
      title: "Como cancelar",
      body: mentionsRefund(policy)
        ? `${contact} A devolução não é automática: ${context.businessName} confirma no painel, em Devolver pelo AgendaPix, e o valor sai da conta Mercado Pago dele.`
        : `${contact} Neste caso o sinal não é devolvido.`,
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
  return [windowSentence(policy), outcomeSentence(policy, context.businessName), refundNote(policy, context.businessName)].filter(Boolean).join(" ");
}
