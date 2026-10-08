import { z } from "zod";

/**
 * Contrato BE-26. O GET billing do #29 ainda não manda `checkout`.
 * O POST abre o WhatsApp no back (303). O front não monta esse endereço.
 */
const pendingRequestSchema = z.object({ requestedAt: z.string().optional() }).catchall(z.unknown());

const checkoutFields = {
  available: z.boolean(),
  unavailableReason: z.string().nullable(),
  activationHours: z.number().int().nonnegative().nullable(),
  pendingRequest: pendingRequestSchema.nullable(),
} as const;

export type PendingSubscriptionRequest = z.infer<typeof pendingRequestSchema>;

export type SubscriptionCheckout = {
  available: boolean;
  unavailableReason: string | null;
  activationHours: number | null;
  pendingRequest: PendingSubscriptionRequest | null;
};

export const CONFIG_MISSING = "config_missing";
export const SUBSCRIPTION_ALREADY_ACTIVE_CODE = "subscription_already_active";

export const SUBSCRIPTION_UNAVAILABLE_COPY = "A assinatura está indisponível no momento. Tente de novo mais tarde.";
export const SUBSCRIPTION_ACTIVE_TOAST = "Assinatura ativa. Seus agendamentos online voltaram.";
export const SUBSCRIPTION_ALREADY_ACTIVE_COPY = "Sua assinatura já está ativa.";
export const SUBSCRIPTION_WHATSAPP_LABEL = "Falar no WhatsApp de novo";
export const SUBSCRIPTION_PENDING_TITLE = "Pedido recebido";
/** Decisão do Teteu: a ativação manual leva até 2 horas. A prévia usa este valor; a tela lê o que o back mandar. */
export const SUBSCRIPTION_MANUAL_ACTIVATION_HOURS = 2;

/** Renovação aparece com 3 dias corridos ou menos no fuso do negócio. Com 4, o botão some. */
export const RENEWAL_WINDOW_DAYS = 3;

export function absentCheckout(): SubscriptionCheckout {
  return { available: false, unavailableReason: null, activationHours: null, pendingRequest: null };
}

/** Lê `checkout` sem derrubar o restante da cobrança. Objeto ausente ou `available` inválido vira o padrão. */
export function parseCheckout(value: unknown): SubscriptionCheckout {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return absentCheckout();
  const record = value as Record<string, unknown>;
  const available = checkoutFields.available.safeParse(record.available);
  if (!available.success) return absentCheckout();
  const unavailableReason = checkoutFields.unavailableReason.safeParse(record.unavailableReason ?? null);
  const activationHours = checkoutFields.activationHours.safeParse(record.activationHours ?? null);
  const pendingRequest = checkoutFields.pendingRequest.safeParse(record.pendingRequest ?? null);
  return {
    available: available.data,
    unavailableReason: unavailableReason.success ? unavailableReason.data : null,
    activationHours: activationHours.success ? activationHours.data : null,
    pendingRequest: pendingRequest.success ? pendingRequest.data : null,
  };
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
  return `Recebemos seu pedido ${when}. Ativamos em até ${activationHours} h, e seus agendamentos online voltam sozinhos.`;
}

export function subscribeHelpCopy(activationHours: number | null) {
  if (activationHours == null) return "Abre o WhatsApp com o pedido pronto.";
  return `Abre o WhatsApp com o pedido pronto. Ativamos em até ${activationHours} h.`;
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

export function subscriptionRaceMessage(body: string) {
  return body.includes(SUBSCRIPTION_ALREADY_ACTIVE_CODE) ? SUBSCRIPTION_ALREADY_ACTIVE_COPY : null;
}

type SubscriptionSnapshot = { status: string; currentPeriodEnd: string | null } | null;

export type SubscriptionCta =
  | { kind: "subscribe"; activationHours: number | null }
  | { kind: "pending"; activationHours: number | null; requestedAt: string | null; allowResend: boolean }
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
  input: { checkout: SubscriptionCheckout; subscription: SubscriptionSnapshot },
  now: Date,
  timeZone: string,
): SubscriptionCta {
  if (input.checkout.pendingRequest) {
    const requestedAt = typeof input.checkout.pendingRequest.requestedAt === "string" ? input.checkout.pendingRequest.requestedAt : null;
    return {
      kind: "pending",
      activationHours: input.checkout.activationHours,
      requestedAt,
      allowResend: input.checkout.activationHours != null,
    };
  }
  const daysLeft = activeDaysLeft(input.subscription, now, timeZone);
  if (daysLeft != null && daysLeft > RENEWAL_WINDOW_DAYS) return { kind: "blocked" };
  if (daysLeft != null && input.subscription?.currentPeriodEnd) return { kind: "renew", periodEnd: input.subscription.currentPeriodEnd };
  if (!input.checkout.available || input.checkout.unavailableReason === CONFIG_MISSING) return { kind: "unavailable" };
  return { kind: "subscribe", activationHours: input.checkout.activationHours };
}

/** Toast uma vez, só na passagem de pedido pendente para assinatura ativa. */
export function subscriptionActivatedToast(wasPending: boolean, pendingNow: boolean, activeNow: boolean) {
  if (pendingNow || !wasPending || !activeNow) return null;
  return SUBSCRIPTION_ACTIVE_TOAST;
}
