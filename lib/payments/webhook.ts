import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { hash } from "../bookings/service";
import { HttpError, MAX_BODY_BYTES, readBody } from "../http";
import { applyPaidEvent } from "./apply-paid";
import { getPaymentProvider } from "./index";
import { paidEventSchema, type PaidEvent, type PaymentProvider } from "./provider";

type Database = NodePgDatabase<typeof schema>;

/**
 * Autentica a entrega sem tocar no banco: provedor, tamanho do corpo, assinatura e formato do evento.
 * Falhas viram 401/400/404/413 sem nenhuma escrita.
 */
export async function verifyWebhookDelivery(request: Request, providerName: string, provider?: PaymentProvider, now = new Date()) {
  const paymentProvider = provider ?? getPaymentProvider();
  if (paymentProvider.name !== providerName) throw new HttpError(404, "provider_not_found", "Provedor não encontrado.");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large", "Os dados enviados ultrapassam o limite permitido.");
  const body = await readBody(request);
  let event: PaidEvent;
  try {
    event = paidEventSchema.parse(await paymentProvider.verifyWebhook(body, request.headers, now));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new HttpError(400, "invalid_event", "Evento inválido.");
    throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
  }
  return { provider: paymentProvider.name, event, bodyHash: hash(body), payloadHash: hash(JSON.stringify(event)) };
}

export async function processWebhook(request: Request, providerName: string, database: Database = getDb(), provider?: PaymentProvider, now = new Date()) {
  const verified = await verifyWebhookDelivery(request, providerName, provider, now);
  const { event } = verified;
  try {
    return await database.transaction(async (transaction) => {
      const [delivery] = await transaction.insert(schema.webhookDeliveries).values({ provider: verified.provider, eventId: event.eventId, bodyHash: verified.bodyHash })
        .onConflictDoNothing({ target: [schema.webhookDeliveries.provider, schema.webhookDeliveries.eventId] }).returning();
      if (!delivery) {
        const [existing] = await transaction.select().from(schema.paymentEvents)
          .where(and(eq(schema.paymentEvents.provider, verified.provider), eq(schema.paymentEvents.eventId, event.eventId))).limit(1);
        if (existing && existing.payloadHash !== verified.payloadHash) throw new HttpError(409, "event_conflict", "Identificador de evento reutilizado com conteúdo diferente.");
        return { outcome: "duplicate", reason: existing?.reason ?? null };
      }
      const result = await applyPaidEvent(transaction, verified.provider, event, now);
      await transaction.update(schema.webhookDeliveries).set(result).where(eq(schema.webhookDeliveries.id, delivery.id));
      return result;
    });
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) throw error;
    throw new HttpError(503, "webhook_unavailable", "Não foi possível processar o evento. Tente novamente.");
  }
}
