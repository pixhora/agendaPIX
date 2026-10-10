import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { webhookEvents } from "../../db/schema";
import { markMpUserDeauthorized } from "./repository";

export const MP_CONNECT_EVENT_PROVIDER = "mercadopago";
/** Limpeza operacional. O app não apaga sozinho: ver docs/CONTRATOS.md. */
export const WEBHOOK_EVENT_RETENTION_DAYS = 30;
export const WEBHOOK_EVENT_REQUEST_ID_MAX = 128;

type Database = Pick<ReturnType<typeof getDb>, "select" | "transaction">;

export type WebhookEventPort = {
  seen(requestId: string): Promise<boolean>;
  record(requestId: string): Promise<"applied" | "duplicate">;
  deauthorize(requestId: string, mpUserId: string): Promise<{ kind: "duplicate" } | { kind: "applied"; businessIds: string[] }>;
};

/** `x-request-id` do Mercado Pago. Vazio, longo ou com caractere de controle não serve de chave. */
export function mpConnectRequestId(header: string | null) {
  const value = header?.trim() ?? "";
  if (!value || value.length > WEBHOOK_EVENT_REQUEST_ID_MAX) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export function createDrizzleWebhookEvents(database: Database = getDb()): WebhookEventPort {
  return {
    async seen(requestId) {
      const [row] = await database.select({ requestId: webhookEvents.requestId }).from(webhookEvents).where(and(
        eq(webhookEvents.provider, MP_CONNECT_EVENT_PROVIDER),
        eq(webhookEvents.requestId, requestId),
      )).limit(1);
      return Boolean(row);
    },
    async record(requestId) {
      return database.transaction(async (tx) => {
        const inserted = await tx.insert(webhookEvents).values({
          provider: MP_CONNECT_EVENT_PROVIDER,
          requestId,
        }).onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.requestId] }).returning({ requestId: webhookEvents.requestId });
        return inserted.length > 0 ? "applied" : "duplicate";
      });
    },
    async deauthorize(requestId, mpUserId) {
      return database.transaction(async (tx) => {
        const inserted = await tx.insert(webhookEvents).values({
          provider: MP_CONNECT_EVENT_PROVIDER,
          requestId,
        }).onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.requestId] }).returning({ requestId: webhookEvents.requestId });
        if (inserted.length === 0) return { kind: "duplicate" as const };
        const businessIds = await markMpUserDeauthorized(tx, mpUserId);
        return { kind: "applied" as const, businessIds };
      });
    },
  };
}

/** Mesma regra do banco, para teste: conflito não repete o efeito; falha do efeito não grava a entrega. */
export function createMemoryWebhookEvents(mark: (mpUserId: string) => Promise<string[]>): WebhookEventPort {
  const seenIds = new Set<string>();
  return {
    async seen(requestId) {
      return seenIds.has(requestId);
    },
    async record(requestId) {
      if (seenIds.has(requestId)) return "duplicate";
      seenIds.add(requestId);
      return "applied";
    },
    async deauthorize(requestId, mpUserId) {
      if (seenIds.has(requestId)) return { kind: "duplicate" };
      const businessIds = await mark(mpUserId);
      seenIds.add(requestId);
      return { kind: "applied", businessIds };
    },
  };
}
