import { z } from "zod";
import { formatBrlCents } from "./summary";
import {
  addCalendarDays,
  formatBusinessDate,
  formatBusinessDateTime,
  localDate,
  MANUAL_REFUND_DEADLINE_DAYS,
} from "../payments/manual-refund-calendar";
import { REFUND_WINDOW_MS, refundBlockMessage, type RefundBlockReason } from "../payments/refund-eligibility";

/** Rótulo do botão que abre o diálogo. A devolução só acontece depois de confirmar. */
export const REFUND_BUTTON_LABEL = "Devolver pelo AgendaPix";
export const CONNECT_LABEL = "Conectar Mercado Pago";
export const OPEN_BOOKING_LABEL = "Abrir agendamento";
export const DATE_LABEL = "Quando foi o pedido de cancelamento?";
export const DATE_HINT = "Use a data em que o cliente pediu, por WhatsApp ou outro canal.";
export const DISCONNECTED_COPY = "Conecte o Mercado Pago de novo para devolver por aqui, ou devolva pelo app do Mercado Pago.";
export const BALANCE_WARNING = "O valor sai do saldo da sua conta Mercado Pago. Precisa ter saldo disponível. O Pix volta para a conta que pagou.";
export const IN_PROCESS_TITLE = "Devolução em andamento";
export const IN_PROCESS_BODY = "O Mercado Pago está processando. Avisamos quando concluir.";
export const REFUNDED_TITLE = "Sinal devolvido";
export const RETRY_LABEL = "Tentar de novo";
export const EVE_CHIP_LABEL = "Prazo vence amanhã";
export const PENDING_LABEL = "Devolução pendente";

const refundReasonSchema = z.enum([
  "not_paid",
  "already_refunded",
  "refund_window_expired",
  "mp_account_not_connected",
  "refund_in_process",
]);

export const refundPreviewSchema = z.object({
  eligible: z.boolean(),
  reason: refundReasonSchema.nullable(),
  amountCents: z.number().int().nonnegative(),
  customer: z.object({
    name: z.string(),
    emailMasked: z.string(),
  }),
  policy: z.object({
    text: z.string().nullable(),
    refundDeadlineAt: z.string().nullable(),
  }).nullable(),
  paidAt: z.string().nullable(),
  requestedOn: z.string().nullable(),
  todayLocal: z.string(),
  paidOnLocal: z.string().nullable(),
  manualRefundDueAt: z.string().nullable(),
});

export type RefundPreview = z.infer<typeof refundPreviewSchema>;

export const refundResultSchema = z.object({
  status: z.enum(["refunded", "in_process"]),
  refundId: z.string().min(1),
});

export type RefundResult = z.infer<typeof refundResultSchema>;

export type RefundUiStatus = "in_process" | "refunded" | "failed" | null;

export function asRefundStatus(value: string | null): RefundUiStatus {
  if (value === "in_process" || value === "refunded" || value === "failed") return value;
  return null;
}

const DATE_FIELD_CODES = new Set([
  "refund_requested_on_invalid",
  "refund_requested_on_in_future",
  "refund_requested_on_before_payment",
]);

const FALLBACK_MESSAGE = "Não foi possível devolver o sinal pelo AgendaPix. Tente de novo.";

export type RefundFailure =
  | { kind: "reload"; message: string }
  | { kind: "field"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "retry"; message: string }
  | { kind: "alert"; message: string };

export function parseRefundPreview(value: unknown): RefundPreview | null {
  const parsed = refundPreviewSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseRefundResult(value: unknown): RefundResult | null {
  const parsed = refundResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Inteiro positivo vira real com vírgula. Zero e valor quebrado não viram "R$ 0,00". */
export function formatRefundAmount(cents: number): string | null {
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return formatBrlCents(BigInt(cents));
}

export function refundTitle(amountLabel: string | null, customerName: string) {
  if (!amountLabel) return `Devolver o sinal para ${customerName}?`;
  return `Devolver ${amountLabel} para ${customerName}?`;
}

export function confirmLabel(amountLabel: string | null) {
  return amountLabel ? `Devolver ${amountLabel}` : "Devolver o sinal";
}

export function customerLine(name: string, emailMasked: string) {
  const email = emailMasked.trim();
  return email ? `${name} · ${email}` : name;
}

/** Texto da regra gravada na reserva. Sem texto, não inventa regra. */
export function policyLine(policy: RefundPreview["policy"]): string | null {
  const text = policy?.text?.trim();
  return text ? text : null;
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function returnByLine(requestedOn: string, timeZone: string, todayLocal?: string): string | null {
  if (!CALENDAR_DAY.test(requestedOn)) return null;
  try {
    const due = formatBusinessDate(addCalendarDays(requestedOn, MANUAL_REFUND_DEADLINE_DAYS), timeZone, {
      style: "sentence",
      todayLocal,
    });
    return `Devolva até ${due}.`;
  } catch {
    return null;
  }
}

/**
 * Dia YYYY-MM-DD do prazo. String de calendário entra como está.
 * O GET também manda o instante ISO (`toISOString` do fim do dia local); aí o dia sai no fuso do negócio, uma vez só.
 */
export function refundDueDay(manualRefundDueAt: string | null, timeZone: string): string | null {
  if (!manualRefundDueAt) return null;
  if (CALENDAR_DAY.test(manualRefundDueAt)) return manualRefundDueAt;
  const instant = new Date(manualRefundDueAt);
  if (Number.isNaN(instant.getTime())) return null;
  try {
    return localDate(instant, timeZone);
  } catch {
    return null;
  }
}

/** Compara dias YYYY-MM-DD. Amanhã é o dia seguinte no calendário, sem relógio. */
export function isDueTomorrow(dueDay: string, todayLocal: string) {
  if (!CALENDAR_DAY.test(dueDay) || !CALENDAR_DAY.test(todayLocal)) return false;
  return dueDay === addCalendarDays(todayLocal, 1);
}

export type DialogDeadline = { kind: "eve" | "returnBy"; text: string };

/**
 * Uma linha só. Data gravada usa o prazo da API. Enquanto o dono escolhe, a prévia é o dia marcado + 7.
 * Se o prazo da API é amanhã, essa frase substitui "Devolva até" — as duas não aparecem com datas diferentes.
 */
export function dialogDeadline(input: {
  requestedOn: string | null;
  pickedOn: string;
  todayLocal: string;
  manualRefundDueAt: string | null;
  timeZone: string;
}): DialogDeadline | null {
  const dueDay = refundDueDay(input.manualRefundDueAt, input.timeZone);
  if (dueDay && isDueTomorrow(dueDay, input.todayLocal)) {
    try {
      return { kind: "eve", text: eveDeadlineLine(sentenceDate(dueDay, input.timeZone, input.todayLocal)) };
    } catch {
      return null;
    }
  }
  if (input.requestedOn) {
    if (!dueDay) return null;
    try {
      return { kind: "returnBy", text: `Devolva até ${sentenceDate(dueDay, input.timeZone, input.todayLocal)}.` };
    } catch {
      return null;
    }
  }
  return input.pickedOn ? returnByDeadline(input.pickedOn, input.timeZone, input.todayLocal) : null;
}

function sentenceDate(isoDate: string, timeZone: string, todayLocal: string) {
  return formatBusinessDate(isoDate, timeZone, { style: "sentence", todayLocal });
}

function returnByDeadline(pickedOn: string, timeZone: string, todayLocal: string): DialogDeadline | null {
  const text = returnByLine(pickedOn, timeZone, todayLocal);
  return text ? { kind: "returnBy", text } : null;
}

export function eveDeadlineLine(dueLabel: string) {
  return `O prazo para devolver vence amanhã, ${dueLabel}.`;
}

export function paidOnLabel(paidAt: string | null, timeZone: string): string | null {
  if (!paidAt) return null;
  const date = new Date(paidAt);
  if (Number.isNaN(date.getTime())) return null;
  return formatBusinessDateTime(date, timeZone);
}

/** Janela do Mercado Pago: `paidAt` + 180 dias (`REFUND_WINDOW_MS`), a mesma conta de `refund_window_expired`. Sem `paidAt`, não inventa prazo. */
export function refundWindowLine(paidAt: string | null, timeZone: string, todayLocal?: string): string | null {
  if (!paidAt) return null;
  const date = new Date(paidAt);
  if (Number.isNaN(date.getTime())) return null;
  const until = new Date(date.getTime() + REFUND_WINDOW_MS);
  const due = formatBusinessDate(localDate(until, timeZone), timeZone, { style: "sentence", todayLocal });
  return `Dá para devolver até ${due} (180 dias).`;
}

export type RequestedDateField =
  | { readOnly: true; value: string }
  | { readOnly: false; value: string; min: string; max: string };

/** Data já gravada fica só leitura. Senão, o picker vai de paidOnLocal até todayLocal, padrão hoje. */
export function requestedDateField(preview: Pick<RefundPreview, "requestedOn" | "todayLocal" | "paidOnLocal">): RequestedDateField {
  if (preview.requestedOn) return { readOnly: true, value: preview.requestedOn };
  const max = preview.todayLocal;
  const min = preview.paidOnLocal && preview.paidOnLocal <= max ? preview.paidOnLocal : max;
  return { readOnly: false, value: max, min, max };
}

function errorParts(body: unknown) {
  if (!body || typeof body !== "object") return { code: "", message: "" };
  const error = (body as { error?: { code?: unknown; message?: unknown } }).error;
  return {
    code: typeof error?.code === "string" ? error.code : "",
    message: typeof error?.message === "string" ? error.message.trim() : "",
  };
}

/** Traduz o status HTTP da API para o lugar certo do diálogo, sem trocar o texto que veio. */
export function mapRefundFailure(status: number, body: unknown): RefundFailure {
  const { code, message } = errorParts(body);
  const text = message || FALLBACK_MESSAGE;
  if (status === 409 && code === "refund_amount_changed") return { kind: "reload", message: text };
  if (status === 422 && DATE_FIELD_CODES.has(code)) return { kind: "field", message: text };
  if (status === 409) return { kind: "blocked", message: text };
  if (status === 502) return { kind: "retry", message: text };
  return { kind: "alert", message: text };
}

export function blockReasonMessage(reason: RefundBlockReason | null) {
  if (!reason) return FALLBACK_MESSAGE;
  return refundBlockMessage(reason);
}

/** Corpo do POST. `sendDate` falso (só leitura ou "Tentar de novo") omite `requestedOn`. */
export function refundRequestBody(input: { expectedAmountCents: number; requestedOn: string | null; sendDate: boolean }) {
  const body: { confirm: true; expectedAmountCents: number; requestedOn?: string } = {
    confirm: true,
    expectedAmountCents: input.expectedAmountCents,
  };
  if (input.sendDate && input.requestedOn) body.requestedOn = input.requestedOn;
  return body;
}

/** O deep link só abre o diálogo quando a prévia diz que dá para devolver. */
export function deepLinkOpensDialog(preview: Pick<RefundPreview, "eligible">) {
  return preview.eligible === true;
}

export type DeepLinkGate = "dialog" | "disconnected" | "blocked";

export function deepLinkGate(preview: Pick<RefundPreview, "eligible" | "reason">): DeepLinkGate {
  if (preview.eligible) return "dialog";
  if (preview.reason === "mp_account_not_connected") return "disconnected";
  return "blocked";
}

export function showRefundAction(input: { depositCents: number; status: string; refundStatus: RefundUiStatus }) {
  if (!Number.isInteger(input.depositCents) || input.depositCents <= 0) return false;
  if (input.refundStatus === "refunded" || input.refundStatus === "in_process") return false;
  return input.status === "confirmed" || input.status === "completed" || input.status === "cancelled";
}

export function refundListMarks(input: { refundStatus: RefundUiStatus; manualRefundDueTomorrow: boolean }) {
  const closed = input.refundStatus === "refunded" || input.refundStatus === "in_process";
  return {
    pending: input.manualRefundDueTomorrow && !closed,
    eve: input.manualRefundDueTomorrow && !closed,
    inProcess: input.refundStatus === "in_process",
    refunded: input.refundStatus === "refunded",
  };
}

/** Nesta base não existe a rota de conexão do Mercado Pago. O link leva às configurações do negócio. */
export function connectMercadoPagoHref(businessId: string) {
  return `/dashboard/settings?businessId=${encodeURIComponent(businessId)}`;
}

export function agendaHref(businessId: string, day: string) {
  return `/dashboard?businessId=${encodeURIComponent(businessId)}&date=${encodeURIComponent(day)}`;
}

export function refundEndpoint(businessId: string, bookingId: string) {
  return `/api/businesses/${encodeURIComponent(businessId)}/bookings/${encodeURIComponent(bookingId)}/refund`;
}
