import { and, eq, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { expirePending, hash, lockBusiness } from "../bookings/service";
import { HttpError } from "../http";
import { decidePaidEvent } from "./rules";
import type { PaidEvent } from "./provider";

type Database = NodePgDatabase<typeof schema>;
export type PaidOutcome = { outcome: string; reason: string | null };

async function audit(database: Database, input: { businessId: string; paymentId: string; bookingId: string; action: string; detail?: Record<string, unknown> }) {
  await database.insert(schema.paymentAudit).values({ ...input, detail: input.detail ?? null });
}

/**
 * Efeito de um pagamento confirmado, compartilhado pelo webhook e pela reconciliação.
 * Deduplica por (provider, eventId), aplica decidePaidEvent e resolve pagamento tardio
 * conforme businesses.latePaymentPolicy. Exige estar dentro de uma transação do chamador
 * quando o efeito precisa ser atômico com a entrega do webhook.
 */
export async function applyPaidEvent(database: Database, providerName: string, event: PaidEvent, now = new Date()): Promise<PaidOutcome> {
  const payloadHash = hash(JSON.stringify(event));
  const [inserted] = await database.insert(schema.paymentEvents).values({
    provider: providerName, eventId: event.eventId, externalId: event.externalId, payloadHash, outcome: "received",
  }).onConflictDoNothing({ target: [schema.paymentEvents.provider, schema.paymentEvents.eventId] }).returning();

  if (!inserted) {
    const [existing] = await database.select().from(schema.paymentEvents)
      .where(and(eq(schema.paymentEvents.provider, providerName), eq(schema.paymentEvents.eventId, event.eventId))).limit(1);
    if (existing.payloadHash !== payloadHash) throw new HttpError(409, "event_conflict", "Identificador de evento reutilizado com conteúdo diferente.");
    return { outcome: "duplicate", reason: existing.reason };
  }

  const [found] = await database.select().from(schema.payments)
    .where(and(eq(schema.payments.provider, providerName), eq(schema.payments.externalId, event.externalId))).limit(1);
  let result: PaidOutcome;
  if (!found) result = { outcome: "ignored", reason: "unknown_payment" };
  else {
    await lockBusiness(database, found.businessId);
    const processingNow = new Date(Math.max(now.getTime(), Date.now()));
    await expirePending(database, found.businessId, processingNow);
    const [payment] = await database.select().from(schema.payments)
      .where(and(eq(schema.payments.businessId, found.businessId), eq(schema.payments.id, found.id))).for("update");
    const [booking] = await database.select().from(schema.bookings)
      .where(and(eq(schema.bookings.businessId, found.businessId), eq(schema.bookings.id, payment.bookingId))).for("update");
    const [business] = await database.select().from(schema.businesses).where(eq(schema.businesses.id, found.businessId)).limit(1);
    const decision = decidePaidEvent(payment, booking, event, processingNow);

    if (decision.recordPaid && payment.status !== "paid") {
      await database.update(schema.payments).set({ status: "paid", paidAt: new Date(event.paidAt) })
        .where(and(eq(schema.payments.businessId, found.businessId), eq(schema.payments.id, payment.id)));
    }
    if (decision.confirm) {
      await database.update(schema.bookings).set({ status: "confirmed" })
        .where(and(eq(schema.bookings.businessId, found.businessId), eq(schema.bookings.id, booking.id), eq(schema.bookings.status, "pending_payment")));
      result = { outcome: decision.outcome, reason: decision.reason };
    } else if (decision.outcome === "ignored" && decision.reason === "late_payment") {
      result = await resolveLatePayment(database, { business, payment, booking, event, now: processingNow });
    } else {
      result = { outcome: decision.outcome, reason: decision.reason };
    }
  }
  await database.update(schema.paymentEvents).set(result).where(eq(schema.paymentEvents.id, inserted.id));
  return result;
}

async function resolveLatePayment(database: Database, input: {
  business: typeof schema.businesses.$inferSelect;
  payment: typeof schema.payments.$inferSelect;
  booking: typeof schema.bookings.$inferSelect;
  event: PaidEvent;
  now: Date;
}): Promise<PaidOutcome> {
  const { business, payment, booking, event, now } = input;
  if (business.latePaymentPolicy === "rebook_if_free" && booking.startsAt > now) {
    // Tenta reabrir o mesmo intervalo: se a exclusão gist não conflitar, confirma; senão marca reembolso.
    try {
      await database.update(schema.bookings).set({ status: "confirmed", expiresAt: null })
        .where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, booking.id), or(eq(schema.bookings.status, "expired"), eq(schema.bookings.status, "pending_payment"))));
      const [current] = await database.select().from(schema.bookings)
        .where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, booking.id))).limit(1);
      if (current.status === "confirmed") {
        await audit(database, { businessId: business.id, paymentId: payment.id, bookingId: booking.id, action: "late_payment_rebooked", detail: { eventId: event.eventId } });
        return { outcome: "processed", reason: "late_rebooked" };
      }
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (!(typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23P01")) throw error;
    }
  }
  await database.update(schema.payments).set({ status: "refund_pending" })
    .where(and(eq(schema.payments.businessId, business.id), eq(schema.payments.id, payment.id), eq(schema.payments.status, "paid")));
  await audit(database, { businessId: business.id, paymentId: payment.id, bookingId: booking.id, action: "late_payment_refund_pending", detail: { eventId: event.eventId, policy: business.latePaymentPolicy } });
  return { outcome: "ignored", reason: "late_payment_refund_pending" };
}

/** Consulta se um intervalo ainda está livre (para testes e decisões fora do update). */
export async function slotIsFree(database: Database, businessId: string, startsAt: Date, endsAt: Date, exceptBookingId?: string) {
  const [row] = await database.execute(sql`SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE business_id = ${businessId}
      AND status IN ('pending_payment', 'confirmed', 'completed')
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(${startsAt}, ${endsAt}, '[)')
      AND (${exceptBookingId ?? null}::uuid IS NULL OR id <> ${exceptBookingId ?? null}::uuid)
  ) AS occupied`).then((result) => result.rows as { occupied: boolean }[]);
  return !row.occupied;
}
