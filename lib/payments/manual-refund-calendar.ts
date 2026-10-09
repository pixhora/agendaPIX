/**
 * Prazo da devolução manual: 7 dias corridos. O dia de origem não conta;
 * vence no fim do 7º dia, no fuso do negócio. Aviso em sex, 16 out → fim de sex, 23 out.
 */
export const MANUAL_REFUND_DEADLINE_DAYS = 7;
export const MANUAL_REFUND_REMINDER_HOUR = 9;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function localDate(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function localHour(instant: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(instant);
  return Number(hour);
}

export function addCalendarDays(isoDate: string, days: number) {
  const match = DATE.exec(isoDate);
  if (!match) throw new Error("Data inválida.");
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${month}-${day}`;
}

function isRealDate(isoDate: string) {
  const match = DATE.exec(isoDate);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

/** Instante UTC em que o relógio local marca essa data e esses segundos. */
export function zonedInstant(isoDate: string, seconds: number, timeZone: string) {
  const midnight = Date.parse(`${isoDate}T00:00:00Z`);
  const wall = midnight + seconds * 1000;
  const offsets = new Set<number>();
  for (const delta of [-86_400_000, 0, 86_400_000]) {
    const sample = new Date(wall + delta);
    const value = zonedParts(sample, timeZone);
    offsets.add(Date.parse(`${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}Z`) - sample.getTime());
  }
  const matches = [...offsets].map((offset) => new Date(wall - offset)).filter((candidate) => {
    const value = zonedParts(candidate, timeZone);
    const clock = Number(value.hour) * 3600 + Number(value.minute) * 60 + Number(value.second);
    return `${value.year}-${value.month}-${value.day}` === isoDate && clock === seconds;
  });
  const found = matches[0];
  if (!found) throw new Error("Horário inexistente nesse fuso.");
  return found;
}

/** Último milissegundo do dia local. */
export function endOfLocalDay(isoDate: string, timeZone: string) {
  return new Date(zonedInstant(addCalendarDays(isoDate, 1), 0, timeZone).getTime() - 1);
}

export function manualRefundDueAt(originDay: string, timeZone: string) {
  return endOfLocalDay(addCalendarDays(originDay, MANUAL_REFUND_DEADLINE_DAYS), timeZone);
}

export function manualRefundDueAtFromNotice(noticeAt: Date, timeZone: string) {
  return manualRefundDueAt(localDate(noticeAt, timeZone), timeZone);
}

function businessParts(instant: Date, timeZone: string, withTime: boolean) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const } : {}),
  }).formatToParts(instant);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value.replace(/\./g, "")]));
}

export function formatBusinessDay(instant: Date, timeZone: string, withWeekday: boolean) {
  const value = businessParts(instant, timeZone, false);
  return withWeekday ? `${value.weekday}, ${value.day} ${value.month}` : `${value.day} ${value.month}`;
}

/** "qui, 8 out, 14:02" no fuso do negócio. */
export function formatBusinessDateTime(instant: Date, timeZone: string) {
  const value = businessParts(instant, timeZone, true);
  return `${value.weekday}, ${value.day} ${value.month}, ${value.hour}:${value.minute}`;
}

export type BusinessDateStyle = "short" | "sentence";

function sentenceParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    weekday: value.weekday.replace(/-feira$/, ""),
    day: value.day,
    month: value.month,
    year: value.year,
  };
}

function referenceYear(timeZone: string, todayLocal?: string) {
  if (todayLocal && DATE.test(todayLocal)) return todayLocal.slice(0, 4);
  return localDate(new Date(), timeZone).slice(0, 4);
}

/**
 * Uma data, dois jeitos. `short` é "qui, 15 out" (chip e metadado).
 * `sentence` é "quinta, 15 de outubro"; o ano entra só se for diferente do ano local de hoje.
 */
export function formatBusinessDate(
  isoDate: string,
  timeZone: string,
  options?: { style?: BusinessDateStyle; todayLocal?: string },
) {
  const instant = zonedInstant(isoDate, 12 * 60 * 60, timeZone);
  if (options?.style !== "sentence") return formatBusinessDay(instant, timeZone, true);
  const value = sentenceParts(instant, timeZone);
  const body = `${value.weekday}, ${value.day} de ${value.month}`;
  return isoDate.slice(0, 4) === referenceYear(timeZone, options.todayLocal) ? body : `${body} de ${value.year}`;
}

export type RequestedOnCode = "refund_requested_on_invalid" | "refund_requested_on_in_future" | "refund_requested_on_before_payment";

export function assessPolicyRequestedOn(input: {
  requestedOn: string | undefined;
  todayLocal: string;
  paidOnLocal: string | null;
  timeZone: string;
}): { ok: true; requestedOn: string; dueAt: Date } | { ok: false; code: RequestedOnCode } {
  const requestedOn = input.requestedOn ?? input.todayLocal;
  if (!isRealDate(requestedOn)) return { ok: false, code: "refund_requested_on_invalid" };
  if (requestedOn > input.todayLocal) return { ok: false, code: "refund_requested_on_in_future" };
  if (input.paidOnLocal && requestedOn < input.paidOnLocal) return { ok: false, code: "refund_requested_on_before_payment" };
  return { ok: true, requestedOn, dueAt: manualRefundDueAt(requestedOn, input.timeZone) };
}

export function manualRefundFlags(input: { dueAt: Date | null; open: boolean; now: Date; timeZone: string }) {
  if (!input.dueAt || !input.open) return { manualRefundOverdue: false, manualRefundDueTomorrow: false };
  const overdue = input.now.getTime() > input.dueAt.getTime();
  const dueDay = localDate(input.dueAt, input.timeZone);
  const today = localDate(input.now, input.timeZone);
  return {
    manualRefundOverdue: overdue,
    manualRefundDueTomorrow: !overdue && today === addCalendarDays(dueDay, -1),
  };
}

export function isOpenManualRefund(input: {
  dueAt: Date | null;
  refundStatus: string | null;
  paymentStatus: string;
  ownerMarked: boolean;
  activeRefund?: boolean;
}) {
  if (!input.dueAt || input.ownerMarked || input.activeRefund) return false;
  if (input.paymentStatus === "refunded" || input.refundStatus === "refunded" || input.refundStatus === "in_process") return false;
  return input.refundStatus === null || input.refundStatus === "failed";
}
