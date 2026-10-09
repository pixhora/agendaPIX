import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { hash } from "../bookings/service";
import { HttpError, MAX_BODY_BYTES, readBody } from "../http";
import { createDrizzleMpStore } from "../mercadopago-oauth/repository";
import { purgeDisconnectedMercadoPagoTokens } from "../mercadopago-oauth/refresh";
import { applyPaidEvent } from "./apply-paid";
import { getPaymentProvider } from "./index";
import {
  drizzleRefundPorts,
  markRefundedByExternalId,
  notifyDisconnectedConfirmation,
  recordUnverifiableSellerPayment,
  settleAutomaticLateRefund,
} from "./refund-flow";
import { IgnoredWebhookEvent, ObservedRefundEvent, UnverifiableSellerPayment, paidEventSchema, type PaidEvent, type PaymentProvider } from "./provider";

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
    event = paidEventSchema.parse(await paymentProvider.verifyWebhook(body, request.headers, now, request.url));
  } catch (error) {
    if (error instanceof HttpError || error instanceof IgnoredWebhookEvent || error instanceof ObservedRefundEvent || error instanceof UnverifiableSellerPayment) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new HttpError(400, "invalid_event", "Evento inválido.");
    throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
  }
  return { provider: paymentProvider.name, event, bodyHash: hash(body), payloadHash: hash(JSON.stringify(event)) };
}

export async function processWebhook(request: Request, providerName: string, database: Database = getDb(), provider?: PaymentProvider, now = new Date()) {
  let verified: Awaited<ReturnType<typeof verifyWebhookDelivery>>;
  try {
    verified = await verifyWebhookDelivery(request, providerName, provider, now);
  } catch (error) {
    // Autenticado, mas não é evento de pagamento: 200 sem escrita (evita o gateway pausar a fila).
    if (error instanceof IgnoredWebhookEvent) return { outcome: "ignored", reason: "unsupported_event" };
    if (error instanceof UnverifiableSellerPayment) {
      await recordUnverifiableSellerPayment(drizzleRefundPorts(database), error.externalId);
      return { outcome: "ignored", reason: "unverifiable_seller_disconnected" };
    }
    if (error instanceof ObservedRefundEvent) {
      await markRefundedByExternalId(drizzleRefundPorts(database), error.externalId, now);
      return { outcome: "ignored", reason: "refund_observed" };
    }
    throw error;
  }
  const { event } = verified;
  try {
    const outcome = await database.transaction(async (transaction) => {
      const [delivery] = await transaction.insert(schema.webhookDeliveries).values({ provider: verified.provider, eventId: event.eventId, bodyHash: verified.bodyHash })
        .onConflictDoNothing({ target: [schema.webhookDeliveries.provider, schema.webhookDeliveries.eventId] }).returning();
      if (!delivery) {
        const [existing] = await transaction.select().from(schema.paymentEvents)
          .where(and(eq(schema.paymentEvents.provider, verified.provider), eq(schema.paymentEvents.eventId, event.eventId))).limit(1);
        if (existing && existing.payloadHash !== verified.payloadHash) throw new HttpError(409, "event_conflict", "Identificador de evento reutilizado com conteúdo diferente.");
        return { outcome: "duplicate", reason: existing?.reason ?? null };
      }
      const result = await applyPaidEvent(transaction, verified.provider, event, now);
      await transaction.update(schema.webhookDeliveries).set({ outcome: result.outcome, reason: result.reason }).where(eq(schema.webhookDeliveries.id, delivery.id));
      return result;
    });
    const paymentProvider = provider ?? getPaymentProvider();
    const ports = drizzleRefundPorts(database);
    if (outcome.reason === "late_no_slot" && outcome.paymentId) {
      try {
        await settleAutomaticLateRefund(ports, paymentProvider, outcome.paymentId);
      } catch {
        // A reconciliação retoma. A resposta continua 200 para o gateway não reenviar o pago.
      }
    } else if (outcome.outcome === "processed" && outcome.paymentId) {
      try {
        await notifyDisconnectedConfirmation(ports, outcome.paymentId);
      } catch {
        // O aviso não desfaz a confirmação.
      }
    }
    try {
      await purgeDisconnectedMercadoPagoTokens({ store: createDrizzleMpStore(database) });
    } catch {
      // A passagem do reconciliador apaga. A resposta continua 200 para o gateway não reenviar.
    }
    return outcome;
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) throw error;
    throw new HttpError(503, "webhook_unavailable", "Não foi possível processar o evento. Tente novamente.");
  }
}
