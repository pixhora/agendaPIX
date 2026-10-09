import { z } from "zod";

/**
 * `checkout` do GET billing, como o BE-26 devolve.
 * A tela não inventa um contrato paralelo nem lê `error.message`.
 */
export type BillingCheckout = {
  provider: "manual";
  available: boolean;
  unavailableReason: "config_missing" | null;
  activationHours: number | null;
  pendingRequest: { id: string; requestedAt: string } | null;
};

export const SUBSCRIPTION_UNAVAILABLE_COPY = "A assinatura está indisponível no momento. Tente de novo mais tarde.";
export const SUBSCRIPTION_OPEN_FAILED_COPY = "Não foi possível abrir a assinatura agora. Tente de novo.";
export const SUBSCRIPTION_ACTIVE_TOAST = "Assinatura ativa. Seus agendamentos online voltaram.";
export const SUBSCRIPTION_ALREADY_ACTIVE_COPY = "Sua assinatura já está ativa.";
export const SUBSCRIPTION_WHATSAPP_LABEL = "Falar no WhatsApp de novo";
export const SUBSCRIPTION_PENDING_TITLE = "Pedido recebido";
/** A prévia promete até 1 hora. A tela lê o `activationHours` que o back mandar. */
export const SUBSCRIPTION_MANUAL_ACTIVATION_HOURS = 1;

export function activationDelayPhrase(hours: number): string {
  return hours === 1 ? "1 hora" : `${hours} horas`;
}
export const SUBSCRIPTION_LOGIN_PATH = "/login";

/** Renovação aparece com 3 dias corridos ou menos no fuso do negócio. Com 4, o botão some. */
export const RENEWAL_WINDOW_DAYS = 3;

const checkoutErrorSchema = z.object({
  error: z.object({ code: z.string() }).strip(),
});

export function unavailableCheckout(): BillingCheckout {
  return { provider: "manual", available: false, unavailableReason: "config_missing", activationHours: null, pendingRequest: null };
}

export function subscriptionCheckoutAction(businessId: string) {
  const id = z.uuid().safeParse(businessId);
  if (!id.success) return null;
  return `/api/businesses/${id.data}/subscription/checkout`;
}

function zonedDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

/** Dias corridos no fuso do negócio, do dia de `now` até o dia de `end`. */
export function businessCalendarDaysUntil(end: Date, now: Date, timeZone: string) {
  const from = zonedDay(now, timeZone);
  const to = zonedDay(end, timeZone);
  if (!from || !to) return null;
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const finish = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((finish - start) / 86_400_000);
}

function sameBusinessDay(left: Date, right: Date, timeZone: string) {
  const a = zonedDay(left, timeZone);
  const b = zonedDay(right, timeZone);
  return !!a && !!b && a.year === b.year && a.month === b.month && a.day === b.day;
}

function formatClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (!hour || !minute) return null;
  return `${hour}:${minute}`;
}

function formatDayMonth(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "numeric", month: "long" }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value.toLocaleLowerCase("pt-BR") ?? "";
  if (!/^[1-9]\d?$/.test(day) || !month) return null;
  return `${day} de ${month}`;
}

/** "hoje às 20:10" ou "em 8 de outubro, às 20:10". */
export function receivedWhenPhrase(requestedAt: string, now: Date, timeZone: string) {
  const date = new Date(requestedAt);
  if (Number.isNaN(date.getTime())) return null;
  const clock = formatClock(date, timeZone);
  if (!clock) return null;
  if (sameBusinessDay(date, now, timeZone)) return `hoje às ${clock}`;
  const day = formatDayMonth(date, timeZone);
  if (!day) return null;
  return `em ${day}, às ${clock}`;
}

export function pendingRequestCopy(when: string, activationHours: number | null) {
  if (activationHours == null) {
    return `Recebemos seu pedido ${when}. Seus agendamentos online voltam assim que a assinatura for ativada.`;
  }
  return `Recebemos seu pedido ${when}. Ativamos em até ${activationDelayPhrase(activationHours)}, e seus agendamentos online voltam sozinhos.`;
}

export function subscribeHelpCopy(activationHours: number | null) {
  if (activationHours == null) return "Abre o WhatsApp com o pedido pronto.";
  return `Abre o WhatsApp com o pedido pronto. Ativamos em até ${activationDelayPhrase(activationHours)}.`;
}

/** "quinta, 15 de outubro" no fuso informado. */
export function formatRenewalDate(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "long", day: "numeric", month: "long" }).formatToParts(date);
  const weekdayLong = parts.find((part) => part.type === "weekday")?.value.toLocaleLowerCase("pt-BR") ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value.toLocaleLowerCase("pt-BR") ?? "";
  if (!weekdayLong || !/^[1-9]\d?$/.test(day) || !month) return null;
  return `${weekdayLong.replace(/-feira$/u, "")}, ${day} de ${month}`;
}

export function renewalDueCopy(periodEnd: string, timeZone: string) {
  const when = formatRenewalDate(periodEnd, timeZone);
  if (!when) return null;
  return `Sua assinatura vence em ${when}.`;
}

export type SubscriptionPostEffect =
  | { kind: "login" }
  | { kind: "notice"; text: string }
  | { kind: "unavailable" };

/** Lê só `error.code`. `message` entra no JSON e sai fora do resultado. */
export function subscriptionPostEffect(body: string): SubscriptionPostEffect | null {
  let code: string;
  try {
    const parsed = checkoutErrorSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return null;
    code = parsed.data.error.code;
  } catch {
    return null;
  }
  switch (code) {
    case "unauthorized":
      return { kind: "login" };
    case "origin_not_allowed":
    case "business_unavailable":
      return { kind: "notice", text: SUBSCRIPTION_OPEN_FAILED_COPY };
    case "subscription_already_active":
      return { kind: "notice", text: SUBSCRIPTION_ALREADY_ACTIVE_COPY };
    case "checkout_unavailable":
      return { kind: "unavailable" };
    default:
      return { kind: "notice", text: SUBSCRIPTION_OPEN_FAILED_COPY };
  }
}

type SubscriptionSnapshot = { status: string; currentPeriodEnd: string | null } | null;

export type SubscriptionCta =
  | { kind: "subscribe"; activationHours: number | null }
  | { kind: "pending"; activationHours: number | null; requestedAt: string; allowResend: boolean }
  | { kind: "unavailable" }
  | { kind: "blocked" }
  | { kind: "renew"; periodEnd: string };

function activeDaysLeft(subscription: SubscriptionSnapshot, now: Date, timeZone: string) {
  if (!subscription || subscription.status !== "active" || !subscription.currentPeriodEnd) return null;
  const end = new Date(subscription.currentPeriodEnd);
  if (Number.isNaN(end.getTime())) return null;
  return businessCalendarDaysUntil(end, now, timeZone);
}

export function subscriptionCta(
  input: { checkout: BillingCheckout; subscription: SubscriptionSnapshot },
  now: Date,
  timeZone: string,
): SubscriptionCta {
  if (input.checkout.pendingRequest) {
    return {
      kind: "pending",
      activationHours: input.checkout.activationHours,
      requestedAt: input.checkout.pendingRequest.requestedAt,
      allowResend: input.checkout.activationHours != null,
    };
  }
  const daysLeft = activeDaysLeft(input.subscription, now, timeZone);
  if (daysLeft != null && daysLeft > RENEWAL_WINDOW_DAYS) return { kind: "blocked" };
  if (daysLeft != null && input.subscription?.currentPeriodEnd) return { kind: "renew", periodEnd: input.subscription.currentPeriodEnd };
  if (!input.checkout.available || input.checkout.unavailableReason === "config_missing") return { kind: "unavailable" };
  return { kind: "subscribe", activationHours: input.checkout.activationHours };
}

/** Toast uma vez, só na passagem de pedido pendente para assinatura ativa. */
export function subscriptionActivatedToast(wasPending: boolean, pendingNow: boolean, activeNow: boolean) {
  if (pendingNow || !wasPending || !activeNow) return null;
  return SUBSCRIPTION_ACTIVE_TOAST;
}
