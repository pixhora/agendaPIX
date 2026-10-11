import { and, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { redactOAuthReturnLog } from "../onboarding/oauth-return";
import {
  mpPixCreateFailureReasonSchema,
  type MpPixCreateFailureReason,
} from "../contracts/mp-pix-create";
import * as schema from "../../db/schema";

type Database = NodePgDatabase<typeof schema>;

/**
 * Cause codes do POST /v1/payments, só onde a referência oficial nomeia o texto.
 * https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/create-payment/post
 *
 * Valor inválido (`mp_invalid_amount`):
 * - 4002 "Transaction_amount attribute can't be null"
 * - 4003 "Transaction_amount attribute must be numeric"
 * - 4023 "Transaction_amount attribute can't be null"
 * - 4024 "Transaction_amount attribute must be numeric"
 * - 4037 "Invalid transaction_amount"
 *
 * Token ou permissão (`mp_unauthorized`):
 * - HTTP 401 "Unauthorized use of live credentials" (access token sem o escopo payment)
 * - 4 "The caller is not authorized to access this resource" (documentado no 403)
 * - 3002 "The caller is not authorized to perform this action"
 * - 3009 "Unauthorized client_id"
 * - pa_unauthorized_result_from_policies
 *   "blocked_by PolicyAgent - At least one policy returned unauthorized"
 *   (header Authorization ausente ou access token não enviado)
 *
 * Chave Pix ausente e conta do cobrador desabilitada não têm cause code nessa página.
 * Esses casos, e qualquer outro texto, ficam `mp_unknown`.
 */
const INVALID_AMOUNT_CAUSES = new Set(["4002", "4003", "4023", "4024", "4037"]);
const UNAUTHORIZED_CAUSES = new Set(["4", "3002", "3009", "pa_unauthorized_result_from_policies"]);

/** 408, 409 e 429 continuam retriáveis: a cobrança pode existir ou o limite passa. */
const DEFINITIVE_REFUSAL = new Set([400, 401, 403, 404, 422]);

const SAFE_CAUSE = /^(?:[0-9]{1,10}|[a-z0-9_]{1,64})$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CAUSES = 8;
const MAX_ERROR_BODY = 8192;

export class PixCreateRefusedError extends Error {
  readonly httpStatus: number;

  constructor(httpStatus: number) {
    super("pix_create_refused");
    this.name = "PixCreateRefusedError";
    this.httpStatus = httpStatus;
  }
}

export function isDefinitivePixRefusal(status: number) {
  return DEFINITIVE_REFUSAL.has(status);
}

export function classifyPixCreateRefusal(status: number, causeCodes: readonly string[]): MpPixCreateFailureReason {
  const codes = causeCodes.filter(isSafeCauseCode);
  if (codes.some((code) => INVALID_AMOUNT_CAUSES.has(code))) return "mp_invalid_amount";
  if (status === 401 || codes.some((code) => UNAUTHORIZED_CAUSES.has(code))) return "mp_unauthorized";
  return "mp_unknown";
}

export function isSafeCauseCode(value: string) {
  return SAFE_CAUSE.test(value);
}

/** Só `cause[].code` curto. Descrição, message e data ficam de fora: o corpo pode ecoar pagador e token. */
export function causeCodesFromMpBody(bodyText: string): string[] {
  if (bodyText.length === 0 || bodyText.length > MAX_ERROR_BODY) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText) as unknown;
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || !("cause" in parsed) || !Array.isArray(parsed.cause)) return [];
  const codes: string[] = [];
  for (const item of parsed.cause) {
    if (codes.length >= MAX_CAUSES) break;
    if (!item || typeof item !== "object" || !("code" in item)) continue;
    const raw = item.code;
    const text = typeof raw === "number" && Number.isInteger(raw) ? String(raw) : typeof raw === "string" ? raw.trim() : "";
    if (!isSafeCauseCode(text)) continue;
    codes.push(text);
  }
  return codes;
}

export function safeMpRequestId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!SAFE_REQUEST_ID.test(trimmed)) return null;
  if (/app_usr|bearer|test-/i.test(trimmed)) return null;
  return trimmed;
}

export type PixCreateLogInput = {
  businessId: string | null;
  paymentId: string;
  mpStatus: number | null;
  causeCodes: readonly string[];
  requestId: string | null;
  reason: MpPixCreateFailureReason;
};

function safeId(value: string | null | undefined) {
  return value && UUID.test(value) ? value : "-";
}

function safeStatus(status: number | null) {
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? String(status) : "-";
}

/** Uma linha. O redator de OAuth tira `code` e `state` se algum campo seguro ainda os carregar. */
export function formatPixCreateLog(input: PixCreateLogInput): string {
  const reason = mpPixCreateFailureReasonSchema.safeParse(input.reason).success ? input.reason : "mp_unknown";
  const cause = input.causeCodes.filter(isSafeCauseCode).slice(0, MAX_CAUSES).join(",") || "-";
  const requestId = safeMpRequestId(input.requestId) ?? "-";
  const line = `[pix-create] business=${safeId(input.businessId)} payment=${safeId(input.paymentId)} mp_status=${safeStatus(input.mpStatus)} mp_cause=${cause} mp_request_id=${requestId} reason=${reason}`;
  return redactOAuthReturnLog(line);
}

export function logPixCreateFailure(input: PixCreateLogInput) {
  console.warn(formatPixCreateLog(input));
}

/**
 * Sai de `creating` só enquanto ninguém anexou o Pix. `failed` não entra na fila da reconciliação.
 * Na mesma transação, a reserva `pending_payment` vai para `expired` (o mesmo status do hold vencido)
 * e o link de horário solta o claim, como no vencimento. Idempotente. Não mexe em Pix já anexado ou pago.
 */
export async function markCreatingPaymentFailed(database: Database, payment: { businessId: string; id: string }) {
  await database.transaction(async (tx) => {
    const [locked] = await tx.select().from(schema.payments).where(and(
      eq(schema.payments.businessId, payment.businessId),
      eq(schema.payments.id, payment.id),
    )).for("update").limit(1);
    if (!locked || locked.externalId) return;
    if (locked.status !== "creating" && locked.status !== "failed") return;
    if (locked.status === "creating") {
      const [marked] = await tx.update(schema.payments).set({ status: "failed" }).where(and(
        eq(schema.payments.businessId, locked.businessId),
        eq(schema.payments.id, locked.id),
        eq(schema.payments.status, "creating"),
        isNull(schema.payments.externalId),
      )).returning({ id: schema.payments.id });
      if (!marked) return;
    }
    const now = new Date();
    const [booking] = await tx.select({ status: schema.bookings.status }).from(schema.bookings).where(and(
      eq(schema.bookings.businessId, locked.businessId),
      eq(schema.bookings.id, locked.bookingId),
    )).for("update").limit(1);
    if (!booking || (booking.status !== "pending_payment" && booking.status !== "expired")) return;
    if (booking.status === "pending_payment") {
      const [released] = await tx.update(schema.bookings).set({ status: "expired", updatedAt: now }).where(and(
        eq(schema.bookings.businessId, locked.businessId),
        eq(schema.bookings.id, locked.bookingId),
        eq(schema.bookings.status, "pending_payment"),
      )).returning({ id: schema.bookings.id });
      if (!released) return;
    }
    await tx.update(schema.slotLinks).set({
      bookingId: null,
      payStartedAt: null,
      payIdempotencyHash: null,
      updatedAt: now,
    }).where(and(
      eq(schema.slotLinks.businessId, locked.businessId),
      eq(schema.slotLinks.bookingId, locked.bookingId),
      sql`${schema.slotLinks.status} NOT IN ('paid', 'cancelled', 'replaced')`,
    ));
  });
}
