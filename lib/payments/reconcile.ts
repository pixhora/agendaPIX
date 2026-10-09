import { and, asc, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import * as schema from "../../db/schema";
import { expirePending, hash, lockBusiness } from "../bookings/service";
import { HttpError } from "../http";
import { paymentsConfig, type PaymentsConfig } from "./config";
import { applyPaidEvent } from "./apply-paid";
import { getPaymentProvider } from "./index";
import { polledPaidEvent, type PaymentProvider, type ProviderCharge } from "./provider";
import { createDrizzleReminderPorts, runManualRefundReminders } from "./manual-refund-reminders";
import { drizzleRefundPorts, observeInProcessRefunds, retryAutomaticLateRefunds } from "./refund-flow";
import { MpAccountNotConnectedError } from "./seller-account";
import { callProvider, ProviderTimeoutError } from "./timeout";

type Database = NodePgDatabase<typeof schema>;
type PoolDatabase = Database & { $client: Pool };
type PaymentRow = typeof schema.payments.$inferSelect;

export type ReconcileReport = {
  stuckRetried: number;
  stuckCancelled: number;
  expiredCancelled: number;
  polledPaid: number;
  refundsSettled: number;
  audits: number;
  skippedLock: boolean;
  /** Falhas isoladas nesta passagem. O relatório só leva a contagem; o detalhe fica no log, sem PII. */
  failures: number;
  /** Pagamentos deixados para a próxima passagem porque o orçamento de tempo acabou. */
  deferred: number;
  /** Etapas que nem começaram porque o orçamento não cobria uma chamada ao gateway mais o que vem depois. */
  stagesSkipped: number;
};

export const RECONCILE_STAGES = ["stuck", "cancel", "poll", "refunds", "observe", "reminders"] as const;
export type ReconcileStage = typeof RECONCILE_STAGES[number];

/** Tempo guardado para cada etapa que ainda não rodou, para uma fila de cancelamento não engolir o resto. */
const STAGE_RESERVE_MS = 2_000;

export type ReconcileBudget = {
  /** False quando não cabe começar mais um item desta etapa e ainda deixar tempo para as seguintes. */
  allow(stage: ReconcileStage): boolean;
};

const RECONCILE_LOCK_KEY = 872014551; // constante estável do processo de reconciliação
const SAFE_CODE = /^[a-z0-9_]+$/i;

/**
 * Código estável para log e relatório. Nunca devolve mensagem do gateway:
 * o corpo pode trazer e-mail, telefone ou token.
 */
export function reconcileFailureCode(error: unknown): string {
  if (error instanceof MpAccountNotConnectedError) return "mp_account_not_connected";
  if (error instanceof ProviderTimeoutError) return "provider_timeout";
  if (error instanceof HttpError) return safeCode(error.code);
  if (isMercadoPagoHttpError(error)) return `mercadopago_http_${error.status}`;
  if (typeof error === "object" && error !== null && "code" in error) return safeCode((error as { code: unknown }).code);
  return "reconcile_failed";
}

function safeCode(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 40 && SAFE_CODE.test(value) ? value : "reconcile_failed";
}

function isMercadoPagoHttpError(error: unknown): error is { status: number } {
  return error instanceof Error && error.name === "MercadoPagoHttpError" && "status" in error && typeof error.status === "number";
}

function emptyReport(): ReconcileReport {
  return {
    stuckRetried: 0, stuckCancelled: 0, expiredCancelled: 0, polledPaid: 0, refundsSettled: 0, audits: 0, skippedLock: false,
    failures: 0, deferred: 0, stagesSkipped: 0,
  };
}

/** Relógio de parede. `startedAt` e `clock` existem para o teste fixar o instante sem fake timers. */
export function wallClockBudget(budgetMs: number, timeoutMs: number, startedAt = Date.now(), clock: () => number = Date.now): ReconcileBudget {
  const deadline = startedAt + budgetMs;
  return {
    allow(stage) {
      const later = RECONCILE_STAGES.length - 1 - RECONCILE_STAGES.indexOf(stage);
      const needed = stage === "reminders" ? 0 : timeoutMs;
      return clock() + needed <= deadline - later * STAGE_RESERVE_MS;
    },
  };
}

function noteFailure(report: ReconcileReport, stage: string, paymentId: string | null, error: unknown) {
  report.failures += 1;
  const payment = paymentId ? ` payment=${paymentId}` : "";
  console.error(`[reconcile] stage=${stage}${payment} code=${reconcileFailureCode(error)}`);
}

async function isolateStage(report: ReconcileReport, stage: ReconcileStage, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    noteFailure(report, stage, null, error);
  }
}

async function gateStage(budget: ReconcileBudget, report: ReconcileReport, stage: ReconcileStage, work: () => Promise<void>) {
  if (!budget.allow(stage)) {
    report.stagesSkipped += 1;
    return;
  }
  await isolateStage(report, stage, work);
}

function deferRest(report: ReconcileReport, total: number, index: number) {
  report.deferred += total - index;
}

async function audit(database: Database, input: { businessId: string; paymentId: string; bookingId: string; action: string; detail?: Record<string, unknown> }) {
  await database.insert(schema.paymentAudit).values({ ...input, detail: input.detail ?? null });
}

async function withTimeout<T>(config: PaymentsConfig, run: (signal: AbortSignal) => Promise<T>) {
  return callProvider(config.PAYMENT_PROVIDER_TIMEOUT_MS, run);
}

function samePayment(payment: Pick<PaymentRow, "id" | "businessId">) {
  return and(eq(schema.payments.id, payment.id), eq(schema.payments.businessId, payment.businessId));
}

/**
 * Uma passagem de reconciliação. Segura advisory lock de sessão para que vários
 * processos possam rodar em paralelo com segurança (um trabalha, os outros saem).
 * Falha de um pagamento não aborta os outros nem as etapas seguintes.
 */
export async function reconcileOnce(
  database?: PoolDatabase,
  provider?: PaymentProvider | null,
  config?: PaymentsConfig,
  now = new Date(),
  budget?: ReconcileBudget,
): Promise<ReconcileReport> {
  const { getDb } = await import("../../db");
  database ??= getDb() as PoolDatabase;
  config ??= paymentsConfig();
  const activeBudget = budget ?? wallClockBudget(config.RECONCILE_BUDGET_MS, config.PAYMENT_PROVIDER_TIMEOUT_MS);
  let activeProvider: PaymentProvider | null = provider === undefined ? null : provider;
  if (provider === undefined) {
    try { activeProvider = getPaymentProvider(); }
    catch {
      // Sem provedor configurado: segue só com passos locais (expirar holds / creating).
      activeProvider = null;
    }
  }
  const report = emptyReport();
  // Lock de sessão exige a mesma conexão PG durante toda a passagem (o Pool do Drizzle alternaria conexões).
  const client: PoolClient = await database.$client.connect();
  try {
    const locked = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [RECONCILE_LOCK_KEY]);
    if (!locked.rows[0]?.ok) return { ...report, skippedLock: true };
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const scoped: Database = drizzle(client, { schema });
    try {
      if (!activeProvider) {
        await isolateStage(report, "stuck", () => expireLocalHolds(scoped, now, config, report, activeBudget));
        await gateStage(activeBudget, report, "reminders", () => sendManualRefundReminders(scoped, now));
        return report;
      }
      await isolateStage(report, "stuck", () => retryStuckCreating(scoped, activeProvider, config, now, report, activeBudget));
      await isolateStage(report, "cancel", () => cancelExpiredPending(scoped, activeProvider, config, now, report, activeBudget));
      await isolateStage(report, "poll", () => pollPendingForMissedWebhooks(scoped, activeProvider, config, now, report, activeBudget));
      await gateStage(activeBudget, report, "refunds", async () => {
        const ports = drizzleRefundPorts(scoped);
        report.refundsSettled += await retryAutomaticLateRefunds(ports, activeProvider, config.RECONCILE_BATCH_SIZE, undefined, (paymentId, error) => {
          noteFailure(report, "refunds", paymentId, error);
        });
      });
      await gateStage(activeBudget, report, "observe", async () => {
        const ports = drizzleRefundPorts(scoped);
        await observeInProcessRefunds(ports, activeProvider, config.RECONCILE_BATCH_SIZE, now, (paymentId, error) => {
          noteFailure(report, "observe", paymentId, error);
        });
      });
      await gateStage(activeBudget, report, "reminders", () => sendManualRefundReminders(scoped, now));
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [RECONCILE_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
  return report;
}

/** Só e-mail. A etapa é isolada: falha aqui não estorna e não derruba o resto da passagem. */
async function sendManualRefundReminders(database: Database, now: Date) {
  await runManualRefundReminders(createDrizzleReminderPorts(database), now);
}

/**
 * Quando o gateway está indisponível (ex.: produção sem Mercado Pago), ainda assim libera
 * horários e marca cobranças creating/pending vencidas — sem falhar o processo inteiro.
 */
async function expireLocalHolds(database: Database, now: Date, config: PaymentsConfig, report: ReconcileReport, budget: ReconcileBudget) {
  const due = await database.select().from(schema.payments).where(and(
    inArray(schema.payments.status, ["creating", "pending"]),
    lte(schema.payments.expiresAt, now),
  )).orderBy(asc(schema.payments.expiresAt), asc(schema.payments.id)).limit(config.RECONCILE_BATCH_SIZE);
  const businessIds = [...new Set(due.map((row) => row.businessId))];
  for (let index = 0; index < businessIds.length; index += 1) {
    if (!budget.allow("stuck")) {
      deferRest(report, businessIds.length, index);
      break;
    }
    const businessId = businessIds[index];
    try {
      await database.transaction(async (tx) => {
        await lockBusiness(tx, businessId);
        await expirePending(tx, businessId, now);
      });
      const rows = due.filter((row) => row.businessId === businessId);
      report.stuckCancelled += rows.filter((row) => row.status === "creating").length;
      report.expiredCancelled += rows.filter((row) => row.status === "pending").length;
    } catch (error) {
      noteFailure(report, "stuck", null, error);
    }
  }
}

async function retryStuckCreating(
  database: Database,
  provider: PaymentProvider,
  config: PaymentsConfig,
  now: Date,
  report: ReconcileReport,
  budget: ReconcileBudget,
) {
  const cutoff = new Date(now.getTime() - config.RECONCILE_STUCK_SECONDS * 1000);
  const stuck = await database.select().from(schema.payments).where(and(
    eq(schema.payments.status, "creating"),
    lt(schema.payments.updatedAt, cutoff),
  )).orderBy(asc(schema.payments.updatedAt), asc(schema.payments.id)).limit(config.RECONCILE_BATCH_SIZE);
  for (let index = 0; index < stuck.length; index += 1) {
    if (!budget.allow("stuck")) {
      deferRest(report, stuck.length, index);
      break;
    }
    const payment = stuck[index];
    try {
      if (payment.expiresAt <= now) await settleExpiredCreating(database, provider, config, payment, now, report);
      else report.stuckRetried += await retryOpenCreating(database, provider, config, payment, now, report);
    } catch (error) {
      noteFailure(report, "stuck", payment.id, error);
      try {
        await database.update(schema.payments).set({ updatedAt: now }).where(and(samePayment(payment), eq(schema.payments.status, "creating")));
      } catch (markError) {
        noteFailure(report, "stuck", payment.id, markError);
      }
    }
  }
}

async function settleExpiredCreating(
  database: Database,
  provider: PaymentProvider,
  config: PaymentsConfig,
  payment: PaymentRow,
  now: Date,
  report: ReconcileReport,
) {
  let remote: ProviderCharge | null = null;
  try {
    remote = await withTimeout(config, (signal) => provider.findChargeByReference(payment.id, { signal, businessId: payment.businessId }));
    if (remote && remote.status !== "paid" && remote.status !== "refunded") {
      const cancelled = await withTimeout(config, (signal) => provider.cancelCharge(remote!.externalId, { signal, businessId: payment.businessId }));
      if (cancelled) remote = cancelled;
    }
  } catch (error) {
    if (error instanceof MpAccountNotConnectedError) {
      await expireCreatingLocally(database, payment, now, report, "mp_account_not_connected");
      noteFailure(report, "stuck", payment.id, error);
      return;
    }
    await releaseBooking(database, payment, now);
    throw error;
  }

  if (remote?.status === "paid" && remote.paidAt) {
    await database.transaction(async (tx) => {
      await tx.update(schema.payments).set({
        status: "pending", externalId: remote!.externalId, qrCodeDataUrl: remote!.qrCodeDataUrl, copyPaste: remote!.copyPaste,
      }).where(and(samePayment(payment), eq(schema.payments.status, "creating")));
      await applyPaidEvent(tx, provider.name, polledPaidEvent(remote!, hash), now);
    });
    return;
  }

  const settled = remoteCancelSettled(remote);
  await database.transaction(async (tx) => {
    await lockBusiness(tx, payment.businessId);
    await expirePending(tx, payment.businessId, now);
    await tx.update(schema.payments).set({
      status: "expired",
      ...(remote ? { externalId: remote.externalId } : {}),
      ...(settled && remote ? { remoteCancelledAt: now } : {}),
    }).where(and(samePayment(payment), eq(schema.payments.status, "creating")));
    await audit(tx, {
      businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "stuck_creating_expired",
      detail: { externalId: remote?.externalId ?? null },
    });
  });
  report.stuckCancelled += 1;
  report.audits += 1;
}

async function expireCreatingLocally(database: Database, payment: PaymentRow, now: Date, report: ReconcileReport, reason: string) {
  await database.transaction(async (tx) => {
    await lockBusiness(tx, payment.businessId);
    await expirePending(tx, payment.businessId, now);
    await audit(tx, {
      businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "stuck_creating_expired",
      detail: { externalId: null, reason },
    });
  });
  report.stuckCancelled += 1;
  report.audits += 1;
}

async function releaseBooking(database: Database, payment: PaymentRow, now: Date) {
  await database.transaction(async (tx) => {
    await lockBusiness(tx, payment.businessId);
    await tx.update(schema.bookings).set({ status: "expired" }).where(and(
      eq(schema.bookings.businessId, payment.businessId),
      eq(schema.bookings.id, payment.bookingId),
      eq(schema.bookings.status, "pending_payment"),
      lte(schema.bookings.expiresAt, now),
    ));
  });
}

async function retryOpenCreating(
  database: Database,
  provider: PaymentProvider,
  config: PaymentsConfig,
  payment: PaymentRow,
  now: Date,
  report: ReconcileReport,
) {
  let charge = await withTimeout(config, (signal) => provider.findChargeByReference(payment.id, { signal, businessId: payment.businessId }));
  if (!charge) {
    const created = await withTimeout(config, (signal) => provider.createPixCharge({
      idempotencyKey: payment.idempotencyKey, reference: payment.id, amountCents: payment.amountCents, expiresAt: payment.expiresAt,
    }, { signal, businessId: payment.businessId }));
    charge = { ...created, reference: payment.id, status: "pending", paidAt: null };
  }
  if (charge.status === "paid" && charge.paidAt) {
    await database.transaction(async (tx) => {
      await tx.update(schema.payments).set({
        status: "pending", externalId: charge!.externalId, qrCodeDataUrl: charge!.qrCodeDataUrl, copyPaste: charge!.copyPaste,
      }).where(and(samePayment(payment), eq(schema.payments.status, "creating")));
      await applyPaidEvent(tx, provider.name, polledPaidEvent(charge!, hash), now);
    });
  } else if (charge.status === "pending") {
    await database.update(schema.payments).set({
      status: "pending", externalId: charge.externalId, qrCodeDataUrl: charge.qrCodeDataUrl, copyPaste: charge.copyPaste,
    }).where(and(samePayment(payment), eq(schema.payments.status, "creating")));
  } else {
    await database.update(schema.payments).set({
      status: "expired", externalId: charge.externalId, ...(remoteCancelSettled(charge) ? { remoteCancelledAt: now } : {}),
    }).where(and(samePayment(payment), eq(schema.payments.status, "creating")));
    report.stuckCancelled += 1;
  }
  await audit(database, {
    businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "stuck_creating_retried",
    detail: { externalId: charge.externalId, status: charge.status },
  });
  report.audits += 1;
  return 1;
}

function remoteCancelSettled(remote: ProviderCharge | null) {
  if (!remote) return true;
  return remote.status === "cancelled" || remote.status === "expired" || remote.status === "refunded";
}

async function cancelExpiredPending(
  database: Database,
  provider: PaymentProvider,
  config: PaymentsConfig,
  now: Date,
  report: ReconcileReport,
  budget: ReconcileBudget,
) {
  const rows = await database.select().from(schema.payments).where(and(
    inArray(schema.payments.status, ["pending", "expired"]),
    lte(schema.payments.expiresAt, now),
    sql`${schema.payments.externalId} IS NOT NULL`,
    isNull(schema.payments.remoteCancelledAt),
  )).orderBy(
    sql`${schema.payments.remoteCancelAttemptedAt} ASC NULLS FIRST`,
    asc(schema.payments.expiresAt),
    asc(schema.payments.id),
  ).limit(config.RECONCILE_BATCH_SIZE);
  for (let index = 0; index < rows.length; index += 1) {
    if (!budget.allow("cancel")) {
      deferRest(report, rows.length, index);
      break;
    }
    const payment = rows[index];
    try {
      await database.transaction(async (tx) => {
        await lockBusiness(tx, payment.businessId);
        await expirePending(tx, payment.businessId, now);
      });
      const remote = await withTimeout(config, (signal) => provider.cancelCharge(payment.externalId!, { signal, businessId: payment.businessId }));
      if (remote?.status === "paid" && remote.paidAt) {
        await database.transaction(async (tx) => { await applyPaidEvent(tx, provider.name, polledPaidEvent(remote, hash), now); });
        continue;
      }
      if (!remoteCancelSettled(remote)) {
        await markCancelAttempt(database, payment, now);
        noteFailure(report, "cancel", payment.id, { code: "cancel_not_settled" });
        continue;
      }
      await database.transaction(async (tx) => {
        await tx.update(schema.payments).set({ remoteCancelledAt: now }).where(and(samePayment(payment), isNull(schema.payments.remoteCancelledAt)));
        await audit(tx, {
          businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "expired_pending_cancelled",
          detail: { externalId: payment.externalId, remoteStatus: remote?.status ?? null },
        });
      });
      report.audits += 1;
      report.expiredCancelled += 1;
    } catch (error) {
      noteFailure(report, "cancel", payment.id, error);
      try { await markCancelAttempt(database, payment, now); }
      catch (markError) { noteFailure(report, "cancel", payment.id, markError); }
    }
  }
}

async function markCancelAttempt(database: Database, payment: PaymentRow, now: Date) {
  await database.update(schema.payments).set({ remoteCancelAttemptedAt: now }).where(and(
    samePayment(payment),
    isNull(schema.payments.remoteCancelledAt),
  ));
}

async function pollPendingForMissedWebhooks(
  database: Database,
  provider: PaymentProvider,
  config: PaymentsConfig,
  now: Date,
  report: ReconcileReport,
  budget: ReconcileBudget,
) {
  const rows = await database.select().from(schema.payments).where(and(
    eq(schema.payments.status, "pending"),
    sql`${schema.payments.expiresAt} > ${now}`,
  )).orderBy(asc(schema.payments.expiresAt), asc(schema.payments.id)).limit(config.RECONCILE_BATCH_SIZE);
  for (let index = 0; index < rows.length; index += 1) {
    if (!budget.allow("poll")) {
      deferRest(report, rows.length, index);
      break;
    }
    const payment = rows[index];
    if (!payment.externalId) continue;
    try {
      const remote = await withTimeout(config, (signal) => provider.getCharge(payment.externalId!, { signal, businessId: payment.businessId }));
      if (!remote || remote.status !== "paid" || !remote.paidAt) continue;
      await database.transaction(async (tx) => {
        const result = await applyPaidEvent(tx, provider.name, polledPaidEvent(remote, hash), now);
        if (result.outcome === "processed" || result.reason === "late_no_slot") {
          await audit(tx, {
            businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "polled_payment_applied",
            detail: { outcome: result.outcome, reason: result.reason },
          });
          report.audits += 1;
        }
      });
      report.polledPaid += 1;
    } catch (error) {
      noteFailure(report, "poll", payment.id, error);
    }
  }
}
