import { and, eq, inArray, lt, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import * as schema from "../../db/schema";
import { expirePending, hash, lockBusiness } from "../bookings/service";
import { paymentsConfig, type PaymentsConfig } from "./config";
import { applyPaidEvent } from "./apply-paid";
import { getPaymentProvider } from "./index";
import { polledPaidEvent, type PaymentProvider } from "./provider";
import { callProvider } from "./timeout";

type Database = NodePgDatabase<typeof schema>;
type PoolDatabase = Database & { $client: Pool };
export type ReconcileReport = {
  stuckRetried: number; stuckCancelled: number; expiredCancelled: number;
  polledPaid: number; audits: number; skippedLock: boolean;
};

const RECONCILE_LOCK_KEY = 872014551; // constante estável do processo de reconciliação

async function audit(database: Database, input: { businessId: string; paymentId: string; bookingId: string; action: string; detail?: Record<string, unknown> }) {
  await database.insert(schema.paymentAudit).values({ ...input, detail: input.detail ?? null });
}

async function withTimeout<T>(config: PaymentsConfig, run: (signal: AbortSignal) => Promise<T>) {
  return callProvider(config.PAYMENT_PROVIDER_TIMEOUT_MS, run);
}

/**
 * Uma passagem de reconciliação. Segura advisory lock de sessão para que vários
 * processos possam rodar em paralelo com segurança (um trabalha, os outros saem).
 */
export async function reconcileOnce(
  database?: PoolDatabase,
  provider?: PaymentProvider,
  config?: PaymentsConfig,
  now = new Date(),
): Promise<ReconcileReport> {
  const { getDb } = await import("../../db");
  database ??= getDb() as PoolDatabase;
  provider ??= getPaymentProvider();
  config ??= paymentsConfig();
  const report: ReconcileReport = { stuckRetried: 0, stuckCancelled: 0, expiredCancelled: 0, polledPaid: 0, audits: 0, skippedLock: false };
  // Lock de sessão exige a mesma conexão PG durante toda a passagem (o Pool do Drizzle alternaria conexões).
  const client: PoolClient = await database.$client.connect();
  try {
    const locked = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [RECONCILE_LOCK_KEY]);
    if (!locked.rows[0]?.ok) return { ...report, skippedLock: true };
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const scoped: Database = drizzle(client, { schema });
    try {
      report.stuckRetried += await retryStuckCreating(scoped, provider, config, now, report);
      report.expiredCancelled += await cancelExpiredPending(scoped, provider, config, now, report);
      report.polledPaid += await pollPendingForMissedWebhooks(scoped, provider, config, now, report);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [RECONCILE_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
  return report;
}

async function retryStuckCreating(database: Database, provider: PaymentProvider, config: PaymentsConfig, now: Date, report: ReconcileReport) {
  const cutoff = new Date(now.getTime() - config.RECONCILE_STUCK_SECONDS * 1000);
  const stuck = await database.select().from(schema.payments).where(and(
    eq(schema.payments.status, "creating"),
    lt(schema.payments.updatedAt, cutoff),
  )).limit(config.RECONCILE_BATCH_SIZE);
  let retried = 0;
  for (const payment of stuck) {
    if (payment.expiresAt <= now) {
      await database.transaction(async (tx) => {
        await lockBusiness(tx, payment.businessId);
        await expirePending(tx, payment.businessId, now);
        const remote = await withTimeout(config, (signal) => provider.findChargeByReference(payment.id, { signal }));
        if (remote) {
          await withTimeout(config, (signal) => provider.cancelCharge(remote.externalId, { signal }));
          await tx.update(schema.payments).set({ externalId: remote.externalId, status: "expired" })
            .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "creating")));
        } else {
          await tx.update(schema.payments).set({ status: "expired" })
            .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "creating")));
        }
        await audit(tx, { businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "stuck_creating_expired", detail: { externalId: remote?.externalId ?? null } });
        report.stuckCancelled++;
        report.audits++;
      });
      continue;
    }
    // Hold ainda válido: tenta criar/anexar; idempotência do gateway evita cobrança dupla.
    try {
      let charge = await withTimeout(config, (signal) => provider.findChargeByReference(payment.id, { signal }));
      if (!charge) {
        const created = await withTimeout(config, (signal) => provider.createPixCharge({
          idempotencyKey: payment.idempotencyKey, reference: payment.id, amountCents: payment.amountCents, expiresAt: payment.expiresAt,
        }, { signal }));
        charge = { ...created, reference: payment.id, status: "pending", paidAt: null };
      }
      if (charge.status === "paid" && charge.paidAt) {
        await database.transaction(async (tx) => {
          await tx.update(schema.payments).set({
            status: "pending", externalId: charge!.externalId, qrCodeDataUrl: charge!.qrCodeDataUrl, copyPaste: charge!.copyPaste,
          }).where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "creating")));
          await applyPaidEvent(tx, provider.name, polledPaidEvent(charge!, hash), now);
        });
      } else if (charge.status === "pending") {
        await database.update(schema.payments).set({
          status: "pending", externalId: charge.externalId, qrCodeDataUrl: charge.qrCodeDataUrl, copyPaste: charge.copyPaste,
        }).where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "creating")));
      } else {
        await database.update(schema.payments).set({ status: "expired", externalId: charge.externalId })
          .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "creating")));
        report.stuckCancelled++;
      }
      await audit(database, { businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "stuck_creating_retried", detail: { externalId: charge.externalId, status: charge.status } });
      report.audits++;
      retried++;
    } catch {
      // Próxima passagem tenta de novo; não engole indefinidamente — o hold eventualmente vence.
    }
  }
  return retried;
}

async function cancelExpiredPending(database: Database, provider: PaymentProvider, config: PaymentsConfig, now: Date, report: ReconcileReport) {
  const rows = await database.select().from(schema.payments).where(and(
    inArray(schema.payments.status, ["pending", "expired"]),
    lte(schema.payments.expiresAt, now),
    sql`${schema.payments.externalId} IS NOT NULL`,
  )).limit(config.RECONCILE_BATCH_SIZE);
  let cancelled = 0;
  for (const payment of rows) {
    // Marca expirado localmente sob o lock do negócio, depois cancela no gateway.
    await database.transaction(async (tx) => {
      await lockBusiness(tx, payment.businessId);
      await expirePending(tx, payment.businessId, now);
    });
    try {
      const remote = await withTimeout(config, (signal) => provider.cancelCharge(payment.externalId!, { signal }));
      if (remote?.status === "paid" && remote.paidAt) {
        await database.transaction(async (tx) => { await applyPaidEvent(tx, provider.name, polledPaidEvent(remote, hash), now); });
        continue;
      }
      await audit(database, { businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "expired_pending_cancelled", detail: { externalId: payment.externalId, remoteStatus: remote?.status ?? null } });
      report.audits++;
      cancelled++;
    } catch { /* próxima passagem */ }
  }
  return cancelled;
}

async function pollPendingForMissedWebhooks(database: Database, provider: PaymentProvider, config: PaymentsConfig, now: Date, report: ReconcileReport) {
  const rows = await database.select().from(schema.payments).where(and(
    eq(schema.payments.status, "pending"),
    sql`${schema.payments.expiresAt} > ${now}`,
  )).limit(config.RECONCILE_BATCH_SIZE);
  let paid = 0;
  for (const payment of rows) {
    if (!payment.externalId) continue;
    try {
      const remote = await withTimeout(config, (signal) => provider.getCharge(payment.externalId!, { signal }));
      if (!remote || remote.status !== "paid" || !remote.paidAt) continue;
      await database.transaction(async (tx) => {
        const result = await applyPaidEvent(tx, provider.name, polledPaidEvent(remote, hash), now);
        if (result.outcome === "processed" || result.reason === "late_rebooked" || result.reason === "late_payment_refund_pending") {
          await audit(tx, { businessId: payment.businessId, paymentId: payment.id, bookingId: payment.bookingId, action: "polled_payment_applied", detail: { outcome: result.outcome, reason: result.reason } });
          report.audits++;
        }
      });
      paid++;
    } catch { /* próxima */ }
  }
  return paid;
}
