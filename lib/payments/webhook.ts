import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { expirePending, hash, lockBusiness } from "../bookings/service";
import { HttpError, MAX_BODY_BYTES, readBody } from "../http";
import { getPaymentProvider } from "./index";
import { paidEventSchema, type PaidEvent, type PaymentProvider } from "./provider";
import { decidePaidEvent } from "./rules";

type Database = NodePgDatabase<typeof schema>;
type Outcome = { outcome: string; reason: string | null };

/**
 * Autentica a entrega sem tocar no banco: provedor, tamanho do corpo, assinatura HMAC (tempo constante, no provider)
 * e formato do evento. Falhas viram 401/400/404/413 sem nenhuma escrita, impedindo spam em webhook_deliveries.
 */
export async function verifyWebhookDelivery(request: Request, providerName: string, provider?: PaymentProvider, now = new Date()) {
  const paymentProvider = provider ?? getPaymentProvider();
  if (paymentProvider.name !== providerName) throw new HttpError(404, "provider_not_found", "Provedor não encontrado.");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large", "Os dados enviados ultrapassam o limite permitido.");
  const body = await readBody(request);
  let event: PaidEvent;
  try {
    event = paidEventSchema.parse(paymentProvider.verifyWebhook(body, request.headers, now));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new HttpError(400, "invalid_event", "Evento inválido.");
    throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
  }
  return { provider: paymentProvider.name, event, bodyHash: hash(body), payloadHash: hash(JSON.stringify(event)) };
}

export async function processWebhook(request: Request, providerName: string, database: Database = getDb(), provider?: PaymentProvider, now = new Date()) {
  const verified = await verifyWebhookDelivery(request, providerName, provider, now);
  const { event, payloadHash } = verified;
  try {
    // Entrega, evento e efeitos de pagamento persistem juntos: falha reverte tudo e o provedor pode reenviar.
    return await database.transaction(async (transaction): Promise<Outcome> => {
      const [delivery] = await transaction.insert(schema.webhookDeliveries).values({ provider: verified.provider, eventId: event.eventId, bodyHash: verified.bodyHash })
        .onConflictDoNothing({ target: [schema.webhookDeliveries.provider, schema.webhookDeliveries.eventId] }).returning();
      if (!delivery) {
        // Replay (inclusive concorrente, que espera o commit do primeiro): sem novas escritas.
        const [existing] = await transaction.select().from(schema.paymentEvents).where(and(eq(schema.paymentEvents.provider, verified.provider), eq(schema.paymentEvents.eventId, event.eventId))).limit(1);
        if (existing && existing.payloadHash !== payloadHash) throw new HttpError(409, "event_conflict", "Identificador de evento reutilizado com conteúdo diferente.");
        return { outcome: "duplicate", reason: existing?.reason ?? null };
      }
      const [inserted] = await transaction.insert(schema.paymentEvents).values({ provider: verified.provider, eventId: event.eventId, externalId: event.externalId, payloadHash, outcome: "received" })
        .onConflictDoNothing({ target: [schema.paymentEvents.provider, schema.paymentEvents.eventId] }).returning();
      let result: Outcome;
      if (!inserted) {
        // Evento registrado antes desta migração, sem linha de entrega correspondente.
        const [existing] = await transaction.select().from(schema.paymentEvents).where(and(eq(schema.paymentEvents.provider, verified.provider), eq(schema.paymentEvents.eventId, event.eventId))).limit(1);
        if (existing.payloadHash !== payloadHash) throw new HttpError(409, "event_conflict", "Identificador de evento reutilizado com conteúdo diferente.");
        result = { outcome: "duplicate", reason: existing.reason };
      } else {
        const [found] = await transaction.select().from(schema.payments).where(and(eq(schema.payments.provider, verified.provider), eq(schema.payments.externalId, event.externalId))).limit(1);
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
    if (error instanceof HttpError && error.status < 500) throw error;
    throw new HttpError(503, "webhook_unavailable", "Não foi possível processar o evento. Tente novamente.");
  }
}
