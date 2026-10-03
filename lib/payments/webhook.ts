import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { expirePending, hash, lockBusiness } from "../bookings/service";
import { HttpError, readBody } from "../http";
import { getPaymentProvider } from "./index";
import { paidEventSchema, type PaymentProvider } from "./provider";
import { decidePaidEvent } from "./rules";

type Database = NodePgDatabase<typeof schema>;

export async function processWebhook(request: Request, providerName: string, database: Database = getDb(), provider?: PaymentProvider, now = new Date()) {
  let delivery: typeof schema.webhookDeliveries.$inferSelect;
  try {
    [delivery] = await database.insert(schema.webhookDeliveries).values({ provider: providerName.slice(0, 100) }).returning();
  } catch { throw new HttpError(503, "webhook_unavailable", "Não foi possível registrar o evento. Tente novamente."); }
  try {
    const body = await readBody(request);
    await database.update(schema.webhookDeliveries).set({ bodyHash: hash(body) }).where(eq(schema.webhookDeliveries.id, delivery.id));
    const paymentProvider = provider ?? getPaymentProvider();
    if (paymentProvider.name !== providerName) throw new HttpError(404, "provider_not_found", "Provedor não encontrado.");
    const event = paidEventSchema.parse(paymentProvider.verifyWebhook(body, request.headers, now));
    const payloadHash = hash(JSON.stringify(event));
    await database.update(schema.webhookDeliveries).set({ eventId: event.eventId }).where(eq(schema.webhookDeliveries.id, delivery.id));
    return await database.transaction(async (transaction) => {
      const [inserted] = await transaction.insert(schema.paymentEvents).values({ provider: providerName, eventId: event.eventId, externalId: event.externalId, payloadHash, outcome: "received" }).onConflictDoNothing({ target: [schema.paymentEvents.provider, schema.paymentEvents.eventId] }).returning();
      let result: { outcome: string; reason: string | null };
      if (!inserted) {
        const [existing] = await transaction.select().from(schema.paymentEvents).where(and(eq(schema.paymentEvents.provider, providerName), eq(schema.paymentEvents.eventId, event.eventId))).limit(1);
        if (existing.payloadHash !== payloadHash) throw new HttpError(409, "event_conflict", "Identificador de evento reutilizado com conteúdo diferente.");
        result = { outcome: "duplicate", reason: existing.reason };
      } else {
        const [found] = await transaction.select().from(schema.payments).where(and(eq(schema.payments.provider, providerName), eq(schema.payments.externalId, event.externalId))).limit(1);
        if (!found) result = { outcome: "ignored", reason: "unknown_payment" };
        else {
          await lockBusiness(transaction, found.businessId);
          // O relógio usado para autenticar não pode prolongar uma reserva enquanto o lock espera.
          const processingNow = new Date(Math.max(now.getTime(), Date.now()));
          await expirePending(transaction, found.businessId, processingNow);
          const [payment] = await transaction.select().from(schema.payments).where(and(eq(schema.payments.businessId, found.businessId), eq(schema.payments.id, found.id))).for("update");
          const [booking] = await transaction.select().from(schema.bookings).where(and(eq(schema.bookings.businessId, found.businessId), eq(schema.bookings.id, payment.bookingId))).for("update");
          const decision = decidePaidEvent(payment, booking, event, processingNow);
          if (decision.recordPaid) await transaction.update(schema.payments).set({ status: "paid", paidAt: new Date(event.paidAt) }).where(and(eq(schema.payments.businessId, found.businessId), eq(schema.payments.id, payment.id)));
          if (decision.confirm) await transaction.update(schema.bookings).set({ status: "confirmed" }).where(and(eq(schema.bookings.businessId, found.businessId), eq(schema.bookings.id, booking.id), eq(schema.bookings.status, "pending_payment")));
          result = { outcome: decision.outcome, reason: decision.reason };
        }
        await transaction.update(schema.paymentEvents).set(result).where(eq(schema.paymentEvents.id, inserted.id));
      }
      await transaction.update(schema.webhookDeliveries).set(result).where(eq(schema.webhookDeliveries.id, delivery.id));
      return result;
    });
  } catch (error) {
    const rejected = error instanceof HttpError && error.status < 500 || error instanceof z.ZodError || error instanceof SyntaxError;
    const reason = error instanceof HttpError ? error.code : rejected ? "invalid_event" : "processing_failed";
    try {
      await database.update(schema.webhookDeliveries).set({ outcome: rejected ? "rejected" : "failed", reason }).where(eq(schema.webhookDeliveries.id, delivery.id));
    } catch { throw new HttpError(503, "webhook_unavailable", "Não foi possível registrar o resultado. Tente novamente."); }
    if (rejected) throw error;
    throw new HttpError(503, "webhook_unavailable", "Não foi possível processar o evento. Tente novamente.");
  }
}
