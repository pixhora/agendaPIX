import { parseCheckout, type SubscriptionCheckout } from "../billing/checkout";

export const LAST_DAYS_THRESHOLD = 2;
export const COMPLETE_PLAN = { name: "Completo", available: false, label: "Em breve" } as const;

export type BillingView = {
  state: "trial" | "trial_ending" | "trial_last_day" | "paused" | "active";
  trialEndsAt: string;
  daysLeft: number;
  bookingsPaused: boolean;
  plan: { name: string; priceCents: number };
  subscription: { status: string; currentPeriodEnd: string | null; provider: string | null } | null;
  checkout: SubscriptionCheckout;
};

export type TrialTone = "none" | "discreet" | "strong" | "paused";

type BillingSource = {
  state: BillingView["state"];
  trialEndsAt: Date | string;
  daysLeft: number;
  bookingsPaused: boolean;
  plan: { name: string; priceCents: number };
  subscription: { status: string; currentPeriodEnd: Date | string | null; provider?: string | null } | null;
  checkout?: unknown;
};

function iso(value: Date | string | null) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function toBillingView(billing: BillingSource): BillingView {
  return {
    state: billing.state,
    trialEndsAt: iso(billing.trialEndsAt) ?? "",
    daysLeft: billing.daysLeft,
    bookingsPaused: billing.bookingsPaused,
    plan: { name: billing.plan.name, priceCents: billing.plan.priceCents },
    subscription: billing.subscription
      ? {
          status: billing.subscription.status,
          currentPeriodEnd: iso(billing.subscription.currentPeriodEnd),
          provider: billing.subscription.provider ?? null,
        }
      : null,
    checkout: parseCheckout(billing.checkout),
  };
}

export function trialTone(billing: Pick<BillingView, "state" | "daysLeft" | "bookingsPaused">): TrialTone {
  if (billing.state === "active") return "none";
  if (billing.state === "paused" || billing.bookingsPaused) return "paused";
  if (billing.daysLeft <= LAST_DAYS_THRESHOLD) return "strong";
  return "discreet";
}

export function formatPlanReais(priceCents: number) {
  const cents = Math.trunc(priceCents);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100).toLocaleString("pt-BR");
  const fraction = absolute % 100;
  return fraction === 0 ? `${sign}R$ ${whole}` : `${sign}R$ ${whole},${String(fraction).padStart(2, "0")}`;
}

const WEEKDAY_LABEL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const MONTH_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;

/** Data por extenso: "na sexta, 2 de outubro". Dia sem zero à esquerda, fuso informado. */
export function formatTrialEndLong(isoDate: string, timeZone: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayLong = read("weekday").toLocaleLowerCase("pt-BR");
  const day = read("day");
  const month = read("month").toLocaleLowerCase("pt-BR");
  if (!weekdayLong || !/^[1-9]\d?$/.test(day) || !month) return "";
  const weekday = weekdayLong.replace(/-feira$/u, "");
  const article = weekdayLong.endsWith("-feira") ? "na" : "no";
  return `${article} ${weekday}, ${day} de ${month}`;
}

export function subscribeCtaLabel(priceCents: number) {
  return `Assinar por ${formatPlanReais(priceCents)}/mês`;
}

export function renewCtaLabel(priceCents: number) {
  return `Renovar por ${formatPlanReais(priceCents)}/mês`;
}

/** Data curta sem ponto de abreviação, para não virar "out.." quando a frase termina. */
export function formatTrialEnd(isoDate: string, timeZone: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", day: "numeric", month: "numeric" }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = WEEKDAY_INDEX[read("weekday") as keyof typeof WEEKDAY_INDEX];
  const day = Number(read("day"));
  const month = Number(read("month"));
  if (weekday === undefined || !Number.isInteger(day) || day < 1 || !Number.isInteger(month) || month < 1 || month > 12) return "";
  return `${WEEKDAY_LABEL[weekday]}, ${day} ${MONTH_LABEL[month - 1]}`;
}

export function trialCopy(billing: Pick<BillingView, "state" | "daysLeft" | "bookingsPaused">, endLabel: string) {
  const tone = trialTone(billing);
  if (tone === "none") return null;
  if (tone === "paused") {
    const when = endLabel ? ` ${endLabel}` : "";
    return {
      tone,
      title: "Novos agendamentos pausados",
      body: `O teste grátis acabou${when}, e não há assinatura ativa.`,
    };
  }
  if (tone === "strong") {
    if (billing.daysLeft <= 0) {
      return {
        tone,
        title: "Seu teste grátis termina hoje, às 23:59",
        body: "Novos agendamentos pausam hoje à noite. A página pública passa a avisar os clientes.",
      };
    }
    if (billing.daysLeft === 1) {
      return {
        tone,
        title: "Seu teste grátis termina amanhã",
        body: `A partir de ${endLabel || "amanhã"}, novos agendamentos pausam. A página pública avisa os clientes.`,
      };
    }
    return {
      tone,
      title: `Seu teste grátis termina em ${billing.daysLeft} dias`,
      body: `Em ${endLabel || `${billing.daysLeft} dias`}, novos agendamentos pausam. A página pública passa a avisar os clientes.`,
    };
  }
  const days = billing.daysLeft === 1 ? "Resta 1 dia" : `Restam ${billing.daysLeft} dias`;
  return {
    tone,
    title: "Teste grátis",
    body: endLabel ? `${days}. Termina ${endLabel}.` : `${days}.`,
  };
}
