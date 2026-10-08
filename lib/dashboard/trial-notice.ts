export const LAST_DAYS_THRESHOLD = 2;
/** Não existe rota de contratação. O aviso mostra o preço e não finge um botão de assinar. */
export const CHECKOUT_AVAILABLE = false;
export const COMPLETE_PLAN = { name: "Completo", available: false, label: "Em breve" } as const;

export type BillingView = {
  state: "trial" | "trial_ending" | "trial_last_day" | "paused" | "active";
  trialEndsAt: string;
  daysLeft: number;
  bookingsPaused: boolean;
  plan: { name: string; priceCents: number };
  subscription: { status: string; currentPeriodEnd: string | null; provider: string | null } | null;
};

export type TrialTone = "none" | "discreet" | "strong" | "paused";

type BillingSource = {
  state: BillingView["state"];
  trialEndsAt: Date | string;
  daysLeft: number;
  bookingsPaused: boolean;
  plan: { name: string; priceCents: number };
  subscription: { status: string; currentPeriodEnd: Date | string | null; provider?: string | null } | null;
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

export function formatTrialEnd(isoDate: string, timeZone: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(date);
}

export function trialCopy(billing: Pick<BillingView, "state" | "daysLeft" | "bookingsPaused">, endLabel: string) {
  const tone = trialTone(billing);
  if (tone === "none") return null;
  if (tone === "paused") {
    const when = endLabel ? ` em ${endLabel}` : "";
    return {
      tone,
      title: "Novos agendamentos pausados",
      body: `O teste grátis acabou${when} sem assinatura ativa. Clientes não marcam horários novos, e a página pública avisa que o agendamento online está pausado. Reservas já feitas continuam valendo.`,
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
