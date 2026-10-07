import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { getBookingPayment } from "../bookings/service";
import { HttpError } from "../http";
import { FakePaymentProvider, signFakeWebhook } from "./fake";
import { getPaymentProvider } from "./index";
import { processWebhook } from "./webhook";

type Database = NodePgDatabase<typeof schema>;

/**
 * Confirma um Pix fake em desenvolvimento pelo mesmo caminho do webhook assinado.
 * Bloqueado em production e quando o provedor não é fake.
 */
export function assertDevFakeSimulationAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(404, "not_found", "Não encontrado.");
  }
  if (process.env.PAYMENT_PROVIDER !== "fake") {
    throw new HttpError(404, "not_found", "Não encontrado.");
  }
}

export async function simulateDevFakePayment(input: {
  slug: string;
  bookingId: string;
  token: string | null;
  database?: Database;
  now?: Date;
}) {
  assertDevFakeSimulationAllowed();
  const database = input.database ?? getDb();
  const now = input.now ?? new Date();

  // Autoriza com o mesmo token do checkout público e obtém o estado atual.
  const view = await getBookingPayment(input.slug, input.bookingId, input.token, database);
  if (view.status === "confirmed" && view.payment?.status === "paid") {
    return { outcome: "duplicate" as const, reason: null as string | null, bookingId: view.bookingId };
  }

  const [payment] = await database
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.bookingId, view.bookingId), eq(schema.payments.status, "pending")))
    .limit(1);

  if (!payment?.externalId) {
    throw new HttpError(409, "payment_unavailable", "Nenhum pagamento pendente para simular.");
  }

  const provider = getPaymentProvider();
  if (!(provider instanceof FakePaymentProvider) || provider.name !== "fake") {
    throw new HttpError(404, "not_found", "Não encontrado.");
  }

  // Alinha o store in-process (reconciliação) quando a cobrança existe neste processo.
  try {
    provider.markPaid(payment.externalId, now);
  } catch {
    // Cobrança pode ter sido criada noutro processo; o webhook/DB basta para confirmar.
  }

  const body = JSON.stringify({
    eventId: `evt-dev-${randomUUID()}`,
    type: "payment.paid",
    externalId: payment.externalId,
    amountCents: payment.amountCents,
    paidAt: now.toISOString(),
  });
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const secret = process.env.FAKE_WEBHOOK_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-this-")) {
    throw new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
  }
  const signature = signFakeWebhook(body, timestamp, secret);
  const request = new Request("http://localhost/api/webhooks/payments/fake", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-fake-timestamp": timestamp,
      "x-fake-signature": signature,
    },
  });

  const result = await processWebhook(request, "fake", database, provider, now);
  return { ...result, bookingId: view.bookingId };
}
