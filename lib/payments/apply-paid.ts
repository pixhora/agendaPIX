import { and, eq, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { expirePending, hash, lockBusiness } from "../bookings/service";
import { HttpError } from "../http";
import type { LateRefundCause } from "./notices";
import { decidePaidEvent } from "./rules";
import type { PaidEvent } from "./provider";

type Database = NodePgDatabase<typeof schema>;
export type PaidOutcome = { outcome: string; reason: string | null; paymentId?: string; businessId?: string; bookingId?: string };

async function audit(database: Database, input: { businessId: string; paymentId: string; bookingId: string; action: string; detail?: Record<string, unknown> }) {
  await database.insert(schema.paymentAudit).values({ ...input, detail: input.detail ?? null });
}

/**
 * Efeito de um pagamento confirmado, compartilhado pelo webhook e pela reconciliação.
 * Deduplica por (provider, eventId) e aplica decidePaidEvent. "No prazo" é a hora de
 * aprovação (`date_approved`), não o relógio deste processamento. Se o hold já liberou a
 * reserva e o horário segue livre, retoma (`on_time_reclaimed`). Pagamento depois do hold
 * não é tratado como confirmado até a reserva gravar `confirmed` (`late_rebooked`, só com
 * `rebook_if_free` e horário livre). Com a política padrão `refund`, todo atraso vira
 * `late_no_slot` e o estorno roda depois do commit, fora desta transação.
 * Não há repasse: o Pix cai na conta do dono.
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
    const ids = { paymentId: payment.id, businessId: found.businessId, bookingId: booking.id };
    if (decision.confirm) {
      await database.update(schema.bookings).set({ status: "confirmed" })
        .where(and(eq(schema.bookings.businessId, found.businessId), eq(schema.bookings.id, booking.id), eq(schema.bookings.status, "pending_payment")));
      await markSlotLinkPaid(database, found.businessId, booking.id, processingNow);
      await audit(database, {
        businessId: found.businessId, paymentId: payment.id, bookingId: booking.id, action: "payment_confirmed",
        detail: { eventId: event.eventId, statusDetail: event.statusDetail ?? null },
      });
      result = { outcome: decision.outcome, reason: decision.reason, ...ids };
    } else if (decision.reason === "on_time_hold_released") {
      result = await reclaimOnTimeBooking(database, { business, payment, booking, event, now: processingNow });
    } else if (decision.outcome === "ignored" && decision.reason === "late_payment") {
      result = await resolveLatePayment(database, { business, payment, booking, event, now: processingNow });
    } else {
      result = { outcome: decision.outcome, reason: decision.reason, ...ids };
    }
  }
  await database.update(schema.paymentEvents).set({ outcome: result.outcome, reason: result.reason }).where(eq(schema.paymentEvents.id, inserted.id));
  return result;
}

/**
 * Aprovação no prazo, mas o hold já expirou a reserva. Retoma se o horário estiver livre.
 * O UPDATE para `confirmed` pode esbarrar na exclusão `bookings_no_overlap` (23P01) quando
 * outra reserva ocupou o intervalo. O savepoint (transação aninhada do Drizzle) desfaz só
 * essa tentativa; a transação de fora grava `late_no_slot` e o estorno segue o fluxo atual.
 * O atraso com `rebook_if_free` usa o savepoint de `resolveLatePayment`.
 */
async function reclaimOnTimeBooking(database: Database, input: {
  business: typeof schema.businesses.$inferSelect;
  payment: typeof schema.payments.$inferSelect;
  booking: typeof schema.bookings.$inferSelect;
  event: PaidEvent;
  now: Date;
}): Promise<PaidOutcome> {
  const { business, payment, booking, event, now } = input;
  const ids = { paymentId: payment.id, businessId: business.id, bookingId: booking.id };
  if (booking.startsAt > now) {
    let reclaimed = false;
    try {
      reclaimed = await database.transaction(async (tx) => {
        await tx.update(schema.bookings).set({ status: "confirmed", expiresAt: null })
          .where(and(
            eq(schema.bookings.businessId, business.id),
            eq(schema.bookings.id, booking.id),
            or(eq(schema.bookings.status, "expired"), eq(schema.bookings.status, "pending_payment")),
          ));
        const [current] = await tx.select().from(schema.bookings)
          .where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, booking.id))).limit(1);
        return current.status === "confirmed";
      });
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (!(typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23P01")) throw error;
    }
    if (reclaimed) {
      await audit(database, {
        businessId: business.id, paymentId: payment.id, bookingId: booking.id, action: "payment_confirmed",
        detail: { eventId: event.eventId, statusDetail: event.statusDetail ?? null, reclaimed: true },
      });
      await markSlotLinkPaid(database, business.id, booking.id, now);
      return { outcome: "processed", reason: "on_time_reclaimed", ...ids };
    }
  }
  await audit(database, {
    businessId: business.id, paymentId: payment.id, bookingId: booking.id, action: "late_no_slot",
    detail: {
      actor: "system", actorUserId: null, amountCents: payment.amountCents, status: null, mpRefundId: null,
      failureCause: null, policyHash: null, reason: "late_no_slot", eventId: event.eventId, statusDetail: event.statusDetail ?? null,
    },
  });
  return { outcome: "ignored", reason: "late_no_slot", ...ids };
}

async function resolveLatePayment(database: Database, input: {
  business: typeof schema.businesses.$inferSelect;
  payment: typeof schema.payments.$inferSelect;
  booking: typeof schema.bookings.$inferSelect;
  event: PaidEvent;
  now: Date;
}): Promise<PaidOutcome> {
  const { business, payment, booking, event, now } = input;
  // `refund` (padrão) devolve sempre. `rebook_if_free` só confirma se o horário ainda estiver livre.
  // Antes dessa gravação o atraso não é tratado como confirmado. Não cria repasse.
  let cause: LateRefundCause = "window_expired";
  if (business.latePaymentPolicy === "rebook_if_free" && booking.startsAt > now) {
    // Savepoint (transação aninhada do Drizzle). O 23P01 da exclusão gist aborta a transação
    // do Postgres se o UPDATE correr no mesmo bloco: late_no_slot não grava, o webhook
    // responde 503 em loop e o estorno não dispara. O rollback do savepoint deixa o bloco válido.
    let rebooked = false;
    try {
      rebooked = await database.transaction(async (savepoint) => {
        await savepoint.update(schema.bookings).set({ status: "confirmed", expiresAt: null })
          .where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, booking.id), or(eq(schema.bookings.status, "expired"), eq(schema.bookings.status, "pending_payment"))));
        const [current] = await savepoint.select().from(schema.bookings)
          .where(and(eq(schema.bookings.businessId, business.id), eq(schema.bookings.id, booking.id))).limit(1);
        return current?.status === "confirmed";
      });
    } catch (error) {
      if (!isExclusionViolation(error)) throw error;
      cause = "slot_taken";
    }
    if (rebooked) {
      await audit(database, { businessId: business.id, paymentId: payment.id, bookingId: booking.id, action: "late_payment_rebooked", detail: { eventId: event.eventId, statusDetail: event.statusDetail ?? null } });
      await markSlotLinkPaid(database, business.id, booking.id, now);
      return { outcome: "processed", reason: "late_rebooked", paymentId: payment.id, businessId: business.id, bookingId: booking.id };
    }
  }
  await audit(database, {
    businessId: business.id, paymentId: payment.id, bookingId: booking.id, action: "late_no_slot",
    detail: {
      actor: "system", actorUserId: null, amountCents: payment.amountCents, status: null, mpRefundId: null,
      failureCause: null, policyHash: null, reason: "late_no_slot", cause, eventId: event.eventId, statusDetail: event.statusDetail ?? null,
    },
  });
  return { outcome: "ignored", reason: "late_no_slot", paymentId: payment.id, businessId: business.id, bookingId: booking.id };
}

async function markSlotLinkPaid(database: Database, businessId: string, bookingId: string, now: Date) {
  const [origin] = await database.select({ slotLinkId: schema.slotLinkBookings.slotLinkId }).from(schema.slotLinkBookings).where(and(
    eq(schema.slotLinkBookings.businessId, businessId),
    eq(schema.slotLinkBookings.bookingId, bookingId),
  )).limit(1);
  if (origin) {
    await database.update(schema.slotLinks).set({ status: "paid", bookingId, updatedAt: now }).where(and(
      eq(schema.slotLinks.businessId, businessId),
      eq(schema.slotLinks.id, origin.slotLinkId),
      sql`${schema.slotLinks.status} <> 'cancelled'`,
    ));
    return;
  }
  await database.update(schema.slotLinks).set({ status: "paid", updatedAt: now }).where(and(
    eq(schema.slotLinks.businessId, businessId),
    eq(schema.slotLinks.bookingId, bookingId),
    sql`${schema.slotLinks.status} <> 'cancelled'`,
  ));
}

function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23P01") return true;
  return error instanceof Error && isExclusionViolation(error.cause);
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
