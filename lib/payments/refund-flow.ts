import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { HttpError } from "../http";
import { sendOwnerEmail, type OwnerMailer } from "../email";
import type { PaymentProvider } from "./provider";
import { paymentsConfig } from "./config";
import { callProvider, ProviderTimeoutError } from "./timeout";
import { z } from "zod";
import { assessPolicyRequestedOn, formatBusinessDay, localDate, manualRefundDueAtFromNotice } from "./manual-refund-calendar";
import { INSUFFICIENT_BALANCE_MESSAGE, insufficientBalance } from "./refund-copy";
import { assessRefund, refundBlockMessage, type RefundBlockReason, type RefundStatus } from "./refund-eligibility";
import {
  disconnectedConfirmedNotice,
  formatAppointment,
  lateRefundFailedNotice,
  lateRefundNoTokenNotice,
  lateRefundedNotice,
  maskEmail,
  unverifiableSellerNotice,
} from "./notices";
import { isSellerDisconnected, settlementAvailable } from "./seller-account";

type Database = NodePgDatabase<typeof schema>;

export type RefundView = {
  paymentId: string;
  businessId: string;
  bookingId: string;
  ownerId: string;
  ownerEmail: string;
  externalId: string | null;
  amountCents: number;
  paymentStatus: string;
  refundStatus: RefundStatus | null;
  refundedAt: Date | null;
  manualRefundDueAt: Date | null;
  policyRefundRequestedOn: string | null;
  paidAt: Date | null;
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  startsAt: Date;
  timezone: string;
  policyText: string | null;
  policyHash: string | null;
  policyRefundDeadlineAt: string | null;
};

export type RefundPatch = {
  refundStatus?: RefundStatus;
  refundedAt?: Date | null;
  paymentStatus?: string;
  /** `undefined` deixa a coluna como está. O prazo gravado não é apagado. */
  manualRefundDueAt?: Date | null;
  policyRefundRequestedOn?: string | null;
};

export type RefundAttemptStatus = "requested" | "processing" | "refunded" | "rejected" | "failed";
export type RefundAttemptKind = "owner_api" | "auto_late" | "owner_manual_mark";

export type RefundAttempt = {
  id: string;
  status: RefundAttemptStatus;
  kind: RefundAttemptKind;
  idempotencyKey: string;
  mpRefundId: string | null;
  amountCents: number;
  requestedByUserId: string | null;
  createdAt: Date;
};

export type RefundWriter = {
  setRefund(patch: RefundPatch): Promise<void>;
  audit(action: string, detail: Record<string, unknown>): Promise<void>;
  hasAudit(action: string): Promise<boolean>;
  listAttempts(): Promise<RefundAttempt[]>;
  beginAttempt(input: { kind: RefundAttemptKind; idempotencyKey: string; amountCents: number; requestedByUserId: string | null }): Promise<RefundAttempt>;
  finishAttempt(id: string, patch: { status: RefundAttemptStatus; mpRefundId: string | null; errorCode: string | null }): Promise<void>;
};

/** Chave de uma tentativa do dono. `n` conta as tentativas já gravadas, inclusive as que falharam. */
export function ownerRefundIdempotencyKey(paymentId: string, attemptNumber: number) {
  return `${paymentId}:${attemptNumber}`;
}

export function automaticRefundIdempotencyKey(paymentId: string) {
  return `auto_late:${paymentId}`;
}

export type RefundPorts = {
  loadOwned(businessId: string, bookingId: string, ownerId: string): Promise<RefundView | null>;
  loadByPaymentId(paymentId: string): Promise<RefundView | null>;
  loadByExternalId(externalId: string): Promise<RefundView | null>;
  withPaymentLock<T>(paymentId: string, run: (view: RefundView, writer: RefundWriter) => Promise<T>): Promise<T>;
  listLateRefundIds(limit: number): Promise<string[]>;
  listInProcessIds(limit: number): Promise<string[]>;
};

export type RefundPreview = {
  eligible: boolean;
  reason: RefundBlockReason | null;
  amountCents: number;
  customer: { name: string; emailMasked: string };
  policy: { text: string | null; refundDeadlineAt: string | null };
  paidAt: string | null;
  requestedOn: string | null;
  todayLocal: string;
  paidOnLocal: string | null;
  manualRefundDueAt: string | null;
};

const REFUND_FAILED = "Não foi possível devolver o sinal pelo AgendaPix. Tente de novo.";

function previewOf(view: RefundView, decision: { eligible: boolean; reason: RefundBlockReason | null }, now: Date): RefundPreview {
  return {
    eligible: decision.eligible,
    reason: decision.reason,
    amountCents: view.amountCents,
    customer: { name: view.customerName, emailMasked: maskEmail(view.customerEmail) },
    policy: { text: view.policyText, refundDeadlineAt: view.policyRefundDeadlineAt },
    paidAt: view.paidAt ? view.paidAt.toISOString() : null,
    requestedOn: view.policyRefundRequestedOn,
    todayLocal: localDate(now, view.timezone),
    paidOnLocal: view.paidAt ? localDate(view.paidAt, view.timezone) : null,
    manualRefundDueAt: view.manualRefundDueAt ? view.manualRefundDueAt.toISOString() : null,
  };
}

function decisionFor(view: RefundView, now: Date, available: boolean) {
  return assessRefund({
    paymentStatus: view.paymentStatus,
    refundStatus: view.refundStatus,
    paidAt: view.paidAt,
    now,
    settlementAvailable: available,
    policyDeadlineAt: view.policyRefundDeadlineAt ? new Date(view.policyRefundDeadlineAt) : null,
  });
}

function keepDeadline(current: RefundView, now: Date) {
  return current.manualRefundDueAt ?? manualRefundDueAtFromNotice(now, current.timezone);
}

function deadlineLabel(view: RefundView) {
  if (!view.manualRefundDueAt) return "";
  return formatBusinessDay(view.manualRefundDueAt, view.timezone, true);
}

function auditDetail(view: RefundView, input: { actor: string; status: string | null; mpRefundId: string | null; failureCause: string | null; reason: string }) {
  return {
    actor: input.actor,
    actorUserId: input.actor === "system" ? null : input.actor,
    amountCents: view.amountCents,
    status: input.status,
    mpRefundId: input.mpRefundId,
    failureCause: input.failureCause,
    policyHash: view.policyHash,
    reason: input.reason,
  };
}

/** O aviso sai fora do lock. A auditoria só entra depois do envio, para uma falha de e-mail poder tentar de novo. */
async function notifyOnce(ports: RefundPorts, view: RefundView, action: string, mailer: OwnerMailer, notice: { subject: string; text: string }) {
  const pending = await ports.withPaymentLock(view.paymentId, async (_current, writer) => !(await writer.hasAudit(action)));
  if (!pending) return;
  await mailer(view.ownerEmail, notice.subject, notice.text);
  await ports.withPaymentLock(view.paymentId, async (_current, writer) => {
    if (await writer.hasAudit(action)) return;
    await writer.audit(action, { actor: "system", paymentId: view.paymentId, subject: notice.subject });
  });
}

async function safeNotify(ports: RefundPorts, view: RefundView, action: string, mailer: OwnerMailer, notice: { subject: string; text: string }) {
  try {
    await notifyOnce(ports, view, action, mailer, notice);
  } catch {
    // O dinheiro já foi commitado. Sem a linha de auditoria, o próximo ciclo reenvia o aviso.
  }
}

function isProviderTimeout(error: unknown) {
  return error instanceof ProviderTimeoutError || (error instanceof Error && error.name === "AbortError");
}

/** `processing` recente ou já aceito pelo gateway não dispara outra chamada. `requested` e `processing` antigo retomam. */
function attemptBlocksRetry(attempt: RefundAttempt) {
  if (attempt.status !== "processing") return false;
  if (attempt.mpRefundId) return true;
  const started = attempt.createdAt?.getTime() ?? Date.now();
  return Date.now() - started < paymentsConfig().PAYMENT_PROVIDER_TIMEOUT_MS + 1_000;
}

function replayRefund(current: RefundView, attempts: RefundAttempt[]) {
  const settled = attempts.find((row) => row.status === "refunded");
  if (settled) return { status: "refunded" as const, refundId: settled.mpRefundId };
  const blocking = attempts.find((row) => attemptBlocksRetry(row));
  if (blocking) return { status: "in_process" as const, refundId: blocking.mpRefundId };
  if (current.refundStatus === "refunded" || current.paymentStatus === "refunded") return { status: "refunded" as const, refundId: null };
  if (current.refundStatus === "in_process") return { status: "in_process" as const, refundId: null };
  return null;
}

async function claimAttempt(writer: RefundWriter, input: { kind: RefundAttemptKind; idempotencyKey: string; amountCents: number; requestedByUserId: string | null }) {
  const attempts = await writer.listAttempts();
  const reusable = attempts.find((row) => row.status === "requested" || (row.status === "processing" && !row.mpRefundId && !attemptBlocksRetry(row)));
  if (reusable) {
    await writer.finishAttempt(reusable.id, { status: "processing", mpRefundId: reusable.mpRefundId, errorCode: null });
    return { ...reusable, status: "processing" as const };
  }
  const created = await writer.beginAttempt(input);
  await writer.finishAttempt(created.id, { status: "processing", mpRefundId: null, errorCode: null });
  return { ...created, status: "processing" as const };
}

async function refundWithTimeout(
  provider: Pick<PaymentProvider, "refundCharge">,
  externalId: string,
  idempotencyKey: string,
  businessId: string,
) {
  const timeoutMs = paymentsConfig().PAYMENT_PROVIDER_TIMEOUT_MS;
  return callProvider(timeoutMs, (signal) => provider.refundCharge(externalId, { idempotencyKey }, {
    signal,
    businessId,
    purpose: "settlement",
  }));
}

async function releaseAttempt(ports: RefundPorts, paymentId: string, attemptId: string) {
  await ports.withPaymentLock(paymentId, async (_current, writer) => {
    await writer.finishAttempt(attemptId, { status: "requested", mpRefundId: null, errorCode: null });
  });
}

export async function previewOwnerRefund(ports: RefundPorts, businessId: string, bookingId: string, ownerId: string, now = new Date()): Promise<RefundPreview> {
  const view = await ports.loadOwned(businessId, bookingId, ownerId);
  if (!view) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  const available = await settlementAvailable(view.businessId);
  return previewOf(view, decisionFor(view, now, available), now);
}

const REQUESTED_ON_MESSAGE: Record<string, string> = {
  refund_requested_on_invalid: "Informe a data do pedido no formato AAAA-MM-DD.",
  refund_requested_on_in_future: "A data do pedido não pode ser futura.",
  refund_requested_on_before_payment: "A data do pedido é anterior ao dia do pagamento do sinal.",
};

const ownerRefundBodySchema = z.object({
  confirm: z.literal(true),
  expectedAmountCents: z.number().int().positive(),
  requestedOn: z.string().optional(),
}).strict();

export function parseOwnerRefundBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_input", "Confira os dados enviados.");
  }
  const body = value as Record<string, unknown>;
  if ("requestedOn" in body && body.requestedOn !== undefined && typeof body.requestedOn !== "string") {
    throw new HttpError(422, "refund_requested_on_invalid", REQUESTED_ON_MESSAGE.refund_requested_on_invalid ?? "Informe a data do pedido.");
  }
  return ownerRefundBodySchema.parse(body);
}

export async function executeOwnerRefund(
  ports: RefundPorts,
  provider: Pick<PaymentProvider, "refundCharge">,
  input: { businessId: string; bookingId: string; ownerId: string; expectedAmountCents: number; requestedOn?: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const view = await ports.loadOwned(input.businessId, input.bookingId, input.ownerId);
  if (!view) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  // Fora do lock: o gancho de OAuth abre outra conexão e não pode esperar a linha do pagamento.
  const available = await settlementAvailable(view.businessId);
  const prepared = await ports.withPaymentLock(view.paymentId, async (current, writer) => {
    const attempts = await writer.listAttempts();
    const replay = replayRefund(current, attempts);
    if (replay) return { type: "ok" as const, status: replay.status, refundId: replay.refundId };
    const resumable = attempts.some((row) => row.status === "requested" || (row.status === "processing" && !row.mpRefundId && !attemptBlocksRetry(row)));
    if (!resumable) {
      if (input.expectedAmountCents !== current.amountCents) {
        return { type: "reject" as const, code: "refund_amount_changed" as const };
      }
      const decision = decisionFor(current, now, available);
      if (!decision.eligible && decision.reason) return { type: "reject" as const, code: decision.reason };
      if (!current.externalId) return { type: "reject" as const, code: "not_paid" as const };
      if (!current.policyRefundRequestedOn) {
        const assessed = assessPolicyRequestedOn({
          requestedOn: input.requestedOn,
          todayLocal: localDate(now, current.timezone),
          paidOnLocal: current.paidAt ? localDate(current.paidAt, current.timezone) : null,
          timeZone: current.timezone,
        });
        if (!assessed.ok) return { type: "date" as const, code: assessed.code };
        await writer.setRefund({
          policyRefundRequestedOn: assessed.requestedOn,
          ...(current.manualRefundDueAt ? {} : { manualRefundDueAt: assessed.dueAt }),
        });
        current.policyRefundRequestedOn = assessed.requestedOn;
        current.manualRefundDueAt = current.manualRefundDueAt ?? assessed.dueAt;
      }
    }
    if (!current.externalId) return { type: "reject" as const, code: "not_paid" as const };
    const attempt = await claimAttempt(writer, {
      kind: "owner_api",
      idempotencyKey: ownerRefundIdempotencyKey(current.paymentId, attempts.length + 1),
      amountCents: current.amountCents,
      requestedByUserId: input.ownerId,
    });
    return { type: "charge" as const, attemptId: attempt.id, idempotencyKey: attempt.idempotencyKey, externalId: current.externalId };
  });
  if (prepared.type === "date") throw new HttpError(422, prepared.code, REQUESTED_ON_MESSAGE[prepared.code] ?? "Informe a data do pedido.");
  if (prepared.type === "reject") {
    const code = prepared.code;
    const message = code === "refund_amount_changed"
      ? "O valor do sinal mudou. Atualize a tela e tente de novo."
      : refundBlockMessage(code);
    throw new HttpError(409, code, message);
  }
  if (prepared.type === "ok") return { status: prepared.status, refundId: prepared.refundId };
  let result;
  try {
    result = await refundWithTimeout(provider, prepared.externalId, prepared.idempotencyKey, view.businessId);
    if (!result) throw new Error("Estorno sem resposta.");
  } catch (error) {
    if (isProviderTimeout(error)) {
      try { await releaseAttempt(ports, view.paymentId, prepared.attemptId); }
      catch { /* Sem o revert, processing antigo volta a ser retomável depois do prazo, com a mesma chave. */ }
      throw new HttpError(503, "refund_unavailable", "O Mercado Pago não respondeu. Tente de novo para retomar a mesma devolução.");
    }
    const cause = error instanceof Error ? error.message : "erro";
    await ports.withPaymentLock(view.paymentId, async (current, writer) => {
      await writer.finishAttempt(prepared.attemptId, {
        status: "failed",
        mpRefundId: null,
        errorCode: insufficientBalance(cause) ? "insufficient_balance" : "refund_failed",
      });
      await writer.setRefund({ refundStatus: "failed", refundedAt: null });
      await writer.audit("owner_refund", { ...auditDetail(current, {
        actor: input.ownerId,
        status: "failed",
        mpRefundId: null,
        failureCause: cause,
        reason: "owner_refund",
      }), requestedOn: current.policyRefundRequestedOn });
    });
    throw new HttpError(502, "refund_failed", insufficientBalance(cause) ? INSUFFICIENT_BALANCE_MESSAGE : REFUND_FAILED);
  }
  try {
    await ports.withPaymentLock(view.paymentId, async (current, writer) => {
      await writer.finishAttempt(prepared.attemptId, {
        status: result.status === "refunded" ? "refunded" : "processing",
        mpRefundId: result.refundId,
        errorCode: null,
      });
      await writer.setRefund({
        refundStatus: result.status,
        refundedAt: result.status === "refunded" ? now : null,
        paymentStatus: result.status === "refunded" ? "refunded" : undefined,
      });
      await writer.audit("owner_refund", { ...auditDetail(current, {
        actor: input.ownerId,
        status: result.status,
        mpRefundId: result.refundId,
        failureCause: null,
        reason: "owner_refund",
      }), requestedOn: current.policyRefundRequestedOn });
    });
  } catch {
    try { await releaseAttempt(ports, view.paymentId, prepared.attemptId); }
    catch { /* A mesma chave retoma quando processing deixar de ser recente. */ }
    throw new HttpError(503, "refund_unavailable", "O Mercado Pago não respondeu. Tente de novo para retomar a mesma devolução.");
  }
  return { status: result.status, refundId: result.refundId };
}

function lateNotice(type: "submitted" | "done" | "failed_now" | "failed_already" | "no_token" | "no_token_already" | "deferred", view: RefundView) {
  const when = formatAppointment(view.startsAt, view.timezone);
  const names = { customerName: view.customerName, serviceName: view.serviceName, when };
  if (type === "submitted" || type === "done") return { action: "notice_late_refunded", notice: lateRefundedNotice(names) };
  if (type === "failed_now" || type === "failed_already") return { action: "notice_late_refund_failed", notice: lateRefundFailedNotice({ ...names, deadlineLabel: deadlineLabel(view) }) };
  if (type === "no_token") return { action: "notice_late_no_token", notice: lateRefundNoTokenNotice({ ...names, deadlineLabel: deadlineLabel(view) }) };
  return null;
}

export async function settleAutomaticLateRefund(
  ports: RefundPorts,
  provider: Pick<PaymentProvider, "refundCharge">,
  paymentId: string,
  mailer: OwnerMailer = sendOwnerEmail,
  now = new Date(),
) {
  const loaded = await ports.loadByPaymentId(paymentId);
  if (!loaded) return "missing" as const;
  const available = await settlementAvailable(loaded.businessId);
  const prepared = await ports.withPaymentLock(paymentId, async (current, writer) => {
    if (current.refundStatus === "in_process" || current.refundStatus === "refunded") return { type: "done" as const, view: current };
    if (current.refundStatus === "failed") return { type: "failed_already" as const, view: current };
    if (await writer.hasAudit("late_no_slot_no_token")) return { type: "no_token_already" as const, view: current };
    const attempts = await writer.listAttempts();
    if (replayRefund(current, attempts)) return { type: "in_flight" as const };
 
    if (!current.externalId) {
      const deadline = keepDeadline(current, now);
      if (!current.manualRefundDueAt) await writer.setRefund({ manualRefundDueAt: deadline });
      await writer.audit("late_no_slot_no_token", auditDetail(current, {
        actor: "system", status: null, mpRefundId: null, failureCause: "sem cobrança", reason: "late_no_slot",
      }));
      return { type: "no_token" as const, view: { ...current, manualRefundDueAt: deadline } };
    }
    if (!available) {
      const deadline = keepDeadline(current, now);
      if (!current.manualRefundDueAt) await writer.setRefund({ manualRefundDueAt: deadline });
      await writer.audit("late_no_slot_no_token", auditDetail(current, {
        actor: "system", status: null, mpRefundId: null, failureCause: "sem token de liquidação", reason: "late_no_slot",
      }));
      await writer.audit("unverifiable_seller_disconnected", auditDetail(current, {
        actor: "system", status: null, mpRefundId: null, failureCause: "sem token de liquidação", reason: "late_no_slot",
      }));
      return { type: "no_token" as const, view: { ...current, manualRefundDueAt: deadline } };
    }
    const attempt = await claimAttempt(writer, {
      kind: "auto_late",
      idempotencyKey: automaticRefundIdempotencyKey(current.paymentId),
      amountCents: current.amountCents,
      requestedByUserId: null,
    });
    return { type: "charge" as const, view: current, attemptId: attempt.id, idempotencyKey: attempt.idempotencyKey, externalId: current.externalId };
  });
  if (prepared.type === "in_flight") return "done" as const;
  if (prepared.type !== "charge") {
    const notice = lateNotice(prepared.type, prepared.view);
    if (notice) await safeNotify(ports, prepared.view, notice.action, mailer, notice.notice);
    return prepared.type;
  }
  let result;
  try {
    result = await refundWithTimeout(provider, prepared.externalId, prepared.idempotencyKey, prepared.view.businessId);
    if (!result) throw new Error("Estorno sem resposta.");
  } catch (error) {
    if (isProviderTimeout(error)) {
      try { await releaseAttempt(ports, paymentId, prepared.attemptId); }
      catch { /* processing antigo é retomado na próxima passagem, com a mesma chave. */ }
      return "deferred" as const;
    }
    const cause = error instanceof Error ? error.message : "erro";
    const view = await ports.withPaymentLock(paymentId, async (current, writer) => {
      const deadline = keepDeadline(current, now);
      await writer.finishAttempt(prepared.attemptId, { status: "failed", mpRefundId: null, errorCode: "refund_failed" });
      await writer.setRefund({ refundStatus: "failed", refundedAt: null, manualRefundDueAt: deadline });
      await writer.audit("automatic_refund", auditDetail(current, {
        actor: "system", status: "failed", mpRefundId: null, failureCause: cause, reason: "late_no_slot",
      }));
      return { ...current, refundStatus: "failed" as const, manualRefundDueAt: deadline };
    });
    const notice = lateNotice("failed_now", view);
    if (notice) await safeNotify(ports, view, notice.action, mailer, notice.notice);
    return "failed_now" as const;
  }
  let view;
  try {
    view = await ports.withPaymentLock(paymentId, async (current, writer) => {
      await writer.finishAttempt(prepared.attemptId, {
        status: result.status === "refunded" ? "refunded" : "processing",
        mpRefundId: result.refundId,
        errorCode: null,
      });
      await writer.setRefund({
        refundStatus: result.status,
        refundedAt: result.status === "refunded" ? now : null,
        paymentStatus: result.status === "refunded" ? "refunded" : undefined,
      });
      await writer.audit("automatic_refund", auditDetail(current, {
        actor: "system",
        status: result.status,
        mpRefundId: result.refundId,
        failureCause: null,
        reason: "late_no_slot",
      }));
      return { ...current, refundStatus: result.status, manualRefundDueAt: current.manualRefundDueAt };
    });
  } catch {
    try { await releaseAttempt(ports, paymentId, prepared.attemptId); }
    catch { /* A mesma chave retoma quando processing deixar de ser recente. */ }
    return "deferred" as const;
  }
  const notice = lateNotice("submitted", view);
  if (notice) await safeNotify(ports, view, notice.action, mailer, notice.notice);
  return "submitted" as const;
}

export async function recordUnverifiableSellerPayment(ports: RefundPorts, externalId: string, mailer: OwnerMailer = sendOwnerEmail, now = new Date()) {
  const view = await ports.loadByExternalId(externalId);
  if (!view) return false;
  const recorded = await ports.withPaymentLock(view.paymentId, async (current, writer) => {
    const deadline = keepDeadline(current, now);
    if (!(await writer.hasAudit("unverifiable_seller_disconnected"))) {
      if (!current.manualRefundDueAt) await writer.setRefund({ manualRefundDueAt: deadline });
      await writer.audit("unverifiable_seller_disconnected", auditDetail(current, {
        actor: "system", status: null, mpRefundId: null, failureCause: "sem token para consultar o pagamento", reason: "unverifiable_seller_disconnected",
      }));
    }
    return { ...current, manualRefundDueAt: current.manualRefundDueAt ?? deadline };
  });
  await notifyOnce(ports, recorded, "notice_unverifiable_seller", mailer, unverifiableSellerNotice({ deadlineLabel: deadlineLabel(recorded) }));
  return true;
}

export async function notifyDisconnectedConfirmation(ports: RefundPorts, paymentId: string, mailer: OwnerMailer = sendOwnerEmail) {
  const view = await ports.loadByPaymentId(paymentId);
  if (!view) return;
  if (!await isSellerDisconnected(view.businessId)) return;
  const notice = disconnectedConfirmedNotice({
    customerName: view.customerName,
    serviceName: view.serviceName,
    when: formatAppointment(view.startsAt, view.timezone),
  });
  await notifyOnce(ports, view, "notice_seller_disconnected", mailer, notice);
}

export async function markRefundedByExternalId(ports: RefundPorts, externalId: string, now = new Date()) {
  const view = await ports.loadByExternalId(externalId);
  if (!view || view.refundStatus === "refunded") return false;
  await ports.withPaymentLock(view.paymentId, async (current, writer) => {
    if (current.refundStatus === "refunded") return;
    await writer.setRefund({ refundStatus: "refunded", refundedAt: now, paymentStatus: "refunded" });
    await writer.audit("refund_observed", auditDetail(current, {
      actor: "system", status: "refunded", mpRefundId: null, failureCause: null, reason: "refund_observed",
    }));
  });
  return true;
}

export async function retryAutomaticLateRefunds(ports: RefundPorts, provider: Pick<PaymentProvider, "refundCharge">, limit: number, mailer?: OwnerMailer) {
  const ids = await ports.listLateRefundIds(limit);
  let settled = 0;
  for (const paymentId of ids) {
    const result = await settleAutomaticLateRefund(ports, provider, paymentId, mailer);
    if (result === "submitted") settled += 1;
  }
  return settled;
}

export async function observeInProcessRefunds(ports: RefundPorts, provider: Pick<PaymentProvider, "getCharge">, limit: number, now = new Date()) {
  const ids = await ports.listInProcessIds(limit);
  let observed = 0;
  for (const paymentId of ids) {
    const view = await ports.loadByPaymentId(paymentId);
    if (!view?.externalId) continue;
    try {
      const remote = await callProvider(paymentsConfig().PAYMENT_PROVIDER_TIMEOUT_MS, (signal) => provider.getCharge(view.externalId!, {
        signal, businessId: view.businessId, purpose: "settlement",
      }));
      if (remote?.status !== "refunded") continue;
      const marked = await markRefundedByExternalId(ports, view.externalId, now);
      if (marked) observed += 1;
    } catch {
      // Sem token ou gateway fora: o próximo ciclo tenta de novo. Não estorna daqui.
    }
  }
  return observed;
}

type PolicySnapshot = { text: string | null; hash: string | null; refundDeadlineAt: string | null };

async function readPolicy(database: Database, businessId: string, bookingId: string): Promise<PolicySnapshot> {
  const result = await database.execute(sql`
    select to_jsonb(b) as doc
    from bookings b
    where b.business_id = ${businessId} and b.id = ${bookingId}
    limit 1
  `);
  const doc = (result.rows[0] as { doc?: Record<string, unknown> } | undefined)?.doc ?? {};
  return {
    text: typeof doc.policy_text === "string" ? doc.policy_text : null,
    hash: typeof doc.policy_hash === "string" ? doc.policy_hash : null,
    refundDeadlineAt: typeof doc.refund_deadline_at === "string" ? doc.refund_deadline_at : null,
  };
}

function toView(row: {
  paymentId: string; businessId: string; bookingId: string; ownerId: string; ownerEmail: string;
  externalId: string | null; amountCents: number; paymentStatus: string;
  refundStatus: RefundStatus | null; refundedAt: Date | null; manualRefundDueAt: Date | null;
  policyRefundRequestedOn: string | null; paidAt: Date | null;
  customerName: string; customerEmail: string | null; serviceName: string; startsAt: Date; timezone: string;
}, policy: PolicySnapshot): RefundView {
  return { ...row, policyText: policy.text, policyHash: policy.hash, policyRefundDeadlineAt: policy.refundDeadlineAt };
}

const refundColumns = {
  paymentId: schema.payments.id,
  businessId: schema.payments.businessId,
  bookingId: schema.payments.bookingId,
  ownerId: schema.businesses.ownerId,
  ownerEmail: schema.user.email,
  externalId: schema.payments.externalId,
  amountCents: schema.payments.amountCents,
  paymentStatus: schema.payments.status,
  refundStatus: schema.payments.refundStatus,
  refundedAt: schema.payments.refundedAt,
  manualRefundDueAt: schema.payments.manualRefundDueAt,
  policyRefundRequestedOn: schema.payments.policyRefundRequestedOn,
  paidAt: schema.payments.paidAt,
  customerName: schema.customers.name,
  customerEmail: schema.customers.email,
  serviceName: schema.services.name,
  startsAt: schema.bookings.startsAt,
  timezone: schema.businesses.timezone,
};

function refundQuery(database: Database) {
  return database.select(refundColumns).from(schema.payments)
    .innerJoin(schema.bookings, and(eq(schema.bookings.id, schema.payments.bookingId), eq(schema.bookings.businessId, schema.payments.businessId)))
    .innerJoin(schema.businesses, eq(schema.businesses.id, schema.payments.businessId))
    .innerJoin(schema.user, eq(schema.user.id, schema.businesses.ownerId))
    .innerJoin(schema.customers, and(eq(schema.customers.id, schema.bookings.customerId), eq(schema.customers.businessId, schema.bookings.businessId)))
    .innerJoin(schema.services, and(eq(schema.services.id, schema.bookings.serviceId), eq(schema.services.businessId, schema.bookings.businessId)));
}

export function createDrizzleRefundPorts(database: Database): RefundPorts {
  async function hydrate(row: Parameters<typeof toView>[0]) {
    const policy = await readPolicy(database, row.businessId, row.bookingId);
    return toView(row, policy);
  }
  return {
    async loadOwned(businessId, bookingId, ownerId) {
      const [row] = await refundQuery(database).where(and(
        eq(schema.payments.businessId, businessId),
        eq(schema.payments.bookingId, bookingId),
        eq(schema.businesses.ownerId, ownerId),
      )).limit(1);
      return row ? hydrate(row) : null;
    },
    async loadByPaymentId(paymentId) {
      const [row] = await refundQuery(database).where(eq(schema.payments.id, paymentId)).limit(1);
      return row ? hydrate(row) : null;
    },
    async loadByExternalId(externalId) {
      const [row] = await refundQuery(database).where(eq(schema.payments.externalId, externalId)).limit(1);
      return row ? hydrate(row) : null;
    },
    async withPaymentLock(paymentId, run) {
      return database.transaction(async (tx) => {
        const locked = await tx.execute(sql`select id from payments where id = ${paymentId} for update`);
        if (locked.rows.length === 0) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
        const [row] = await refundQuery(tx).where(eq(schema.payments.id, paymentId)).limit(1);
        if (!row) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
        const view = await toView(row, await readPolicy(tx, row.businessId, row.bookingId));
        const writer: RefundWriter = {
          async setRefund(patch) {
            await tx.update(schema.payments).set({
              ...(patch.refundStatus !== undefined ? { refundStatus: patch.refundStatus } : {}),
              ...(patch.refundedAt !== undefined ? { refundedAt: patch.refundedAt } : {}),
              ...(patch.paymentStatus ? { status: patch.paymentStatus as typeof schema.payments.$inferSelect.status } : {}),
              ...(patch.manualRefundDueAt !== undefined ? { manualRefundDueAt: patch.manualRefundDueAt } : {}),
              ...(patch.policyRefundRequestedOn !== undefined ? { policyRefundRequestedOn: patch.policyRefundRequestedOn } : {}),
            }).where(and(eq(schema.payments.id, paymentId), eq(schema.payments.businessId, view.businessId)));
            if (patch.refundStatus !== undefined) view.refundStatus = patch.refundStatus;
            if (patch.refundedAt !== undefined) view.refundedAt = patch.refundedAt;
            if (patch.paymentStatus) view.paymentStatus = patch.paymentStatus;
            if (patch.manualRefundDueAt !== undefined) view.manualRefundDueAt = patch.manualRefundDueAt;
            if (patch.policyRefundRequestedOn !== undefined) view.policyRefundRequestedOn = patch.policyRefundRequestedOn;
          },
          async audit(action, detail) {
            await tx.insert(schema.paymentAudit).values({
              businessId: view.businessId, paymentId, bookingId: view.bookingId, action, detail,
            });
          },
          async hasAudit(action) {
            const [found] = await tx.select({ id: schema.paymentAudit.id }).from(schema.paymentAudit).where(and(
              eq(schema.paymentAudit.paymentId, paymentId),
              eq(schema.paymentAudit.action, action),
            )).limit(1);
            return Boolean(found);
          },
          async listAttempts() {
            return tx.select({
              id: schema.paymentRefunds.id,
              status: schema.paymentRefunds.status,
              kind: schema.paymentRefunds.kind,
              idempotencyKey: schema.paymentRefunds.idempotencyKey,
              mpRefundId: schema.paymentRefunds.mpRefundId,
              amountCents: schema.paymentRefunds.amountCents,
              requestedByUserId: schema.paymentRefunds.requestedByUserId,
              createdAt: schema.paymentRefunds.createdAt,
            }).from(schema.paymentRefunds).where(and(
              eq(schema.paymentRefunds.paymentId, paymentId),
              eq(schema.paymentRefunds.businessId, view.businessId),
            ));
          },
          async beginAttempt(input) {
            const [created] = await tx.insert(schema.paymentRefunds).values({
              businessId: view.businessId,
              paymentId,
              bookingId: view.bookingId,
              amountCents: input.amountCents,
              kind: input.kind,
              status: "requested",
              requestedByUserId: input.requestedByUserId,
              idempotencyKey: input.idempotencyKey,
            }).returning({
              id: schema.paymentRefunds.id,
              status: schema.paymentRefunds.status,
              kind: schema.paymentRefunds.kind,
              idempotencyKey: schema.paymentRefunds.idempotencyKey,
              mpRefundId: schema.paymentRefunds.mpRefundId,
              amountCents: schema.paymentRefunds.amountCents,
              requestedByUserId: schema.paymentRefunds.requestedByUserId,
              createdAt: schema.paymentRefunds.createdAt,
            });
            if (!created) throw new Error("Tentativa de devolução não gravada.");
            return created;
          },
          async finishAttempt(id, patch) {
            await tx.update(schema.paymentRefunds).set({
              status: patch.status,
              mpRefundId: patch.mpRefundId,
              errorCode: patch.errorCode,
              finishedAt: patch.status === "requested" ? null : new Date(),
            }).where(and(
              eq(schema.paymentRefunds.id, id),
              eq(schema.paymentRefunds.businessId, view.businessId),
            ));
          },
        };
        return run(view, writer);
      });
    },
    async listLateRefundIds(limit) {
      const rows = await database.execute(sql`
        select distinct p.id as id
        from payments p
        inner join payment_audit a on a.payment_id = p.id and a.action = 'late_no_slot'
        where p.refund_status is null
          and p.status = 'paid'
          and not exists (
            select 1 from payment_audit n
            where n.payment_id = p.id and n.action = 'late_no_slot_no_token'
          )
        limit ${limit}
      `);
      return (rows.rows as { id: string }[]).map((row) => row.id);
    },
    async listInProcessIds(limit) {
      const rows = await database.select({ id: schema.payments.id }).from(schema.payments)
        .where(eq(schema.payments.refundStatus, "in_process")).limit(limit);
      return rows.map((row) => row.id);
    },
  };
}

export function drizzleRefundPorts(database: Database) {
  return createDrizzleRefundPorts(database);
}
