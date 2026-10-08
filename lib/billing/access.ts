export const TRIAL_LENGTH_DAYS = 7;

export type BookingAccessState = "trial" | "trial_ending" | "trial_last_day" | "paused" | "active";

export type SubscriptionAccess = {
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: Date | null;
  provider?: string | null;
};

export type BookingAccess = {
  state: BookingAccessState;
  trialEndsAt: Date;
  daysLeft: number;
  bookingsPaused: boolean;
};

type ZonedDate = { year: number; month: number; day: number };

function zonedDate(date: Date, timeZone: string): ZonedDate {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function shiftDate(date: ZonedDate, days: number): ZonedDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function calendarDaysBetween(from: ZonedDate, to: ZonedDate) {
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((end - start) / 86_400_000);
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Fim do 7º dia local (23:59:59), contando o dia da criação. */
export function trialEndsAtFromCreation(createdAt: Date, timeZone: string) {
  const end = shiftDate(zonedDate(createdAt, timeZone), TRIAL_LENGTH_DAYS - 1);
  const guess = new Date(Date.UTC(end.year, end.month - 1, end.day, 23, 59, 59));
  return new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
}

function subscriptionGrantsAccess(subscription: SubscriptionAccess | null, now: Date) {
  return Boolean(
    subscription &&
      (subscription.status === "active" || subscription.status === "trialing") &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd.getTime() > now.getTime(),
  );
}

/** Renovação antecipada a partir de D-3 (dias de calendário no fuso do negócio). */
export const SUBSCRIPTION_RENEWAL_LEAD_DAYS = 3;

/**
 * 409 subscription_already_active: status active e faltam mais de 3 dias para currentPeriodEnd.
 * Trialing, past_due, canceled, sem fim de período ou dentro da janela D-3 não bloqueiam.
 */
export function subscriptionCheckoutBlocked(subscription: SubscriptionAccess | null, timeZone: string, now: Date) {
  if (!subscription || subscription.status !== "active" || !subscription.currentPeriodEnd) return false;
  const daysUntilEnd = calendarDaysBetween(zonedDate(now, timeZone), zonedDate(subscription.currentPeriodEnd, timeZone));
  return daysUntilEnd > SUBSCRIPTION_RENEWAL_LEAD_DAYS;
}

/** Fim de período que ainda libera acesso pela regra do #29. Fora isso, a renovação conta de agora. */
export function accessGrantingPeriodEnd(subscription: SubscriptionAccess | null, now: Date) {
  if (!subscription?.currentPeriodEnd || !subscriptionGrantsAccess(subscription, now)) return null;
  return subscription.currentPeriodEnd;
}

export function getBookingAccess(
  business: { trialEndsAt: Date; timezone: string },
  subscription: SubscriptionAccess | null,
  now: Date,
): BookingAccess {
  const daysLeft = calendarDaysBetween(zonedDate(now, business.timezone), zonedDate(business.trialEndsAt, business.timezone));
  const trialOpen = now.getTime() <= business.trialEndsAt.getTime();
  if (subscriptionGrantsAccess(subscription, now)) {
    return { state: "active", trialEndsAt: business.trialEndsAt, daysLeft, bookingsPaused: false };
  }
  if (!trialOpen) return { state: "paused", trialEndsAt: business.trialEndsAt, daysLeft, bookingsPaused: true };
  const state: BookingAccessState = daysLeft <= 0 ? "trial_last_day" : daysLeft <= 3 ? "trial_ending" : "trial";
  return { state, trialEndsAt: business.trialEndsAt, daysLeft, bookingsPaused: false };
}
