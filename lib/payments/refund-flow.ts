import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { HttpError } from "../http";
import { sendOwnerEmail, type OwnerMailer } from "../email";
import type { PaymentProvider } from "./provider";
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
import { getSellerLinkState, settlementAvailable } from "./seller-account";

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

export type RefundWriter = {
  setRefund(patch: { refundStatus: RefundStatus; refundedAt: Date | null; paymentStatus?: string }): Promise<void>;
  audit(action: string, detail: Record<string, unknown>): Promise<void>;
  hasAudit(action: string): Promise<boolean>;
};

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
};

const REFUND_FAILED = "Não foi possível devolver o sinal pelo AgendaPix. Tente de novo.";

function previewOf(view: RefundView, decision: { eligible: boolean; reason: RefundBlockReason | null }): RefundPreview {
  return {
    eligible: decision.eligible,
    reason: decision.reason,
    amountCents: view.amountCents,
    customer: { name: view.customerName, emailMasked: maskEmail(view.customerEmail) },
    policy: { text: view.policyText, refundDeadlineAt: view.policyRefundDeadlineAt },
    paidAt: view.paidAt ? view.paidAt.toISOString() : null,
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

async function notifyOnce(ports: RefundPorts, view: RefundView, action: string, mailer: OwnerMailer, notice: { subject: string; text: string }) {
  await ports.withPaymentLock(view.paymentId, async (_current, writer) => {
    if (await writer.hasAudit(action)) return;
    await mailer(view.ownerEmail, notice.subject, notice.text);
    await writer.audit(action, { actor: "system", paymentId: view.paymentId, subject: notice.subject });
  });
}

export async function previewOwnerRefund(ports: RefundPorts, businessId: string, bookingId: string, ownerId: string, now = new Date()): Promise<RefundPreview> {
  const view = await ports.loadOwned(businessId, bookingId, ownerId);
  if (!view) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  const available = await settlementAvailable(view.businessId);
  return previewOf(view, decisionFor(view, now, available));
}

export async function executeOwnerRefund(
  ports: RefundPorts,
  provider: Pick<PaymentProvider, "refundCharge">,
  input: { businessId: string; bookingId: string; ownerId: string; expectedAmountCents: number; now?: Date },
) {
  const now = input.now ?? new Date();
  const view = await ports.loadOwned(input.businessId, input.bookingId, input.ownerId);
  if (!view) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  const outcome = await ports.withPaymentLock(view.paymentId, async (current, writer) => {
    if (input.expectedAmountCents !== current.amountCents) {
      return { type: "reject" as const, code: "refund_amount_changed" as const };
    }
    const available = await settlementAvailable(current.businessId);
    const decision = decisionFor(current, now, available);
    if (!decision.eligible && decision.reason) return { type: "reject" as const, code: decision.reason };
    if (!current.externalId) return { type: "reject" as const, code: "not_paid" as const };
    try {
      const result = await provider.refundCharge(current.externalId, { idempotencyKey: current.paymentId }, {
        businessId: current.businessId,
        purpose: "settlement",
      });
      if (!result) throw new Error("Estorno sem resposta.");
      const refundedAt = result.status === "refunded" ? now : null;
      await writer.setRefund({
        refundStatus: result.status,
        refundedAt,
        paymentStatus: result.status === "refunded" ? "refunded" : undefined,
      });
      await writer.audit("owner_refund", auditDetail(current, {
        actor: input.ownerId,
        status: result.status,
        mpRefundId: result.refundId,
        failureCause: null,
        reason: "owner_refund",
      }));
      return { type: "ok" as const, status: result.status, refundId: result.refundId };
    } catch (error) {
      const cause = error instanceof Error ? error.message : "erro";
      await writer.setRefund({ refundStatus: "failed", refundedAt: null });
      await writer.audit("owner_refund", auditDetail(current, {
        actor: input.ownerId,
        status: "failed",
        mpRefundId: null,
        failureCause: cause,
        reason: "owner_refund",
      }));
      return { type: "provider_failed" as const };
    }
  });
  if (outcome.type === "reject") {
    const code = outcome.code;
    const message = code === "refund_amount_changed"
      ? "O valor do sinal mudou. Atualize a tela e tente de novo."
      : refundBlockMessage(code);
    throw new HttpError(409, code, message);
  }
  if (outcome.type === "provider_failed") throw new HttpError(502, "refund_failed", REFUND_FAILED);
  return { status: outcome.status, refundId: outcome.refundId };
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
  const outcome = await ports.withPaymentLock(paymentId, async (current, writer) => {
    if (current.refundStatus === "in_process" || current.refundStatus === "refunded") return { type: "done" as const, view: current };
    if (current.refundStatus === "failed") return { type: "failed_already" as const, view: current };
    if (await writer.hasAudit("late_no_slot_no_token")) return { type: "no_token_already" as const, view: current };
    if (!current.externalId) {
      await writer.audit("late_no_slot_no_token", auditDetail(current, {
        actor: "system", status: null, mpRefundId: null, failureCause: "sem cobrança", reason: "late_no_slot",
      }));
      return { type: "no_token" as const, view: current };
    }
    if (!await settlementAvailable(current.businessId)) {
      await writer.audit("late_no_slot_no_token", auditDetail(current, {
        actor: "system", status: null, mpRefundId: null, failureCause: "sem token de liquidação", reason: "late_no_slot",
      }));
      await writer.audit("unverifiable_seller_disconnected", auditDetail(current, {
        actor: "system", status: null, mpRefundId: null, failureCause: "sem token de liquidação", reason: "late_no_slot",
      }));
      return { type: "no_token" as const, view: current };
    }
    try {
      const result = await provider.refundCharge(current.externalId, { idempotencyKey: current.paymentId }, {
        businessId: current.businessId,
        purpose: "settlement",
      });
      if (!result) throw new Error("Estorno sem resposta.");
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
      return { type: "submitted" as const, view: { ...current, refundStatus: result.status } };
    } catch (error) {
      const cause = error instanceof Error ? error.message : "erro";
      await writer.setRefund({ refundStatus: "failed", refundedAt: null });
      await writer.audit("automatic_refund", auditDetail(current, {
        actor: "system", status: "failed", mpRefundId: null, failureCause: cause, reason: "late_no_slot",
      }));
      return { type: "failed_now" as const, view: { ...current, refundStatus: "failed" as const } };
    }
  });

  const when = formatAppointment(outcome.view.startsAt, outcome.view.timezone);
  const names = { customerName: outcome.view.customerName, serviceName: outcome.view.serviceName, when };
  if (outcome.type === "submitted" || outcome.type === "done") {
    await notifyOnce(ports, outcome.view, "notice_late_refunded", mailer, lateRefundedNotice(names));
  } else if (outcome.type === "failed_now" || outcome.type === "failed_already") {
    await notifyOnce(ports, outcome.view, "notice_late_refund_failed", mailer, lateRefundFailedNotice(names));
  } else if (outcome.type === "no_token") {
    await notifyOnce(ports, outcome.view, "notice_late_no_token", mailer, lateRefundNoTokenNotice(names));
  }
  return outcome.type;
}

export async function recordUnverifiableSellerPayment(ports: RefundPorts, externalId: string, mailer: OwnerMailer = sendOwnerEmail) {
  const view = await ports.loadByExternalId(externalId);
  if (!view) return false;
  await ports.withPaymentLock(view.paymentId, async (current, writer) => {
    if (await writer.hasAudit("unverifiable_seller_disconnected")) return;
    await writer.audit("unverifiable_seller_disconnected", auditDetail(current, {
      actor: "system", status: null, mpRefundId: null, failureCause: "sem token para consultar o pagamento", reason: "unverifiable_seller_disconnected",
    }));
  });
  await notifyOnce(ports, view, "notice_unverifiable_seller", mailer, unverifiableSellerNotice());
  return true;
}

export async function notifyDisconnectedConfirmation(ports: RefundPorts, paymentId: string, mailer: OwnerMailer = sendOwnerEmail) {
  const view = await ports.loadByPaymentId(paymentId);
  if (!view) return;
  if (await getSellerLinkState(view.businessId) !== "disconnected") return;
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
      const remote = await provider.getCharge(view.externalId, { businessId: view.businessId, purpose: "settlement" });
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
  refundStatus: RefundStatus | null; refundedAt: Date | null; paidAt: Date | null;
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
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${paymentId}))`);
        const [row] = await refundQuery(tx).where(eq(schema.payments.id, paymentId)).limit(1);
        if (!row) throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
        const view = await toView(row, await readPolicy(tx, row.businessId, row.bookingId));
        const writer: RefundWriter = {
          async setRefund(patch) {
            await tx.update(schema.payments).set({
              refundStatus: patch.refundStatus,
              refundedAt: patch.refundedAt,
              ...(patch.paymentStatus ? { status: patch.paymentStatus as typeof schema.payments.$inferSelect.status } : {}),
            }).where(and(eq(schema.payments.id, paymentId), eq(schema.payments.businessId, view.businessId)));
            view.refundStatus = patch.refundStatus;
            view.refundedAt = patch.refundedAt;
            if (patch.paymentStatus) view.paymentStatus = patch.paymentStatus;
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
