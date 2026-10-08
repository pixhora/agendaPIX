import { and, asc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import type { SubscriptionProviderId } from "./providers/types";

type Database = Pick<NodePgDatabase<typeof schema>, "select" | "insert">;

export type OpenSubscriptionRequest = {
  id: string;
  requestedAt: Date;
  provider: string;
};

function isUniqueViolation(error: unknown) {
  const candidates = [error, error instanceof Error ? error.cause : undefined];
  return candidates.some((candidate) => typeof candidate === "object" && candidate !== null && "code" in candidate && (candidate as { code?: string }).code === "23505");
}

export async function loadOpenSubscriptionRequest(businessId: string, database: Pick<Database, "select">): Promise<OpenSubscriptionRequest | null> {
  const [row] = await database.select({
    id: schema.subscriptionRequests.id,
    requestedAt: schema.subscriptionRequests.requestedAt,
    provider: schema.subscriptionRequests.provider,
  }).from(schema.subscriptionRequests).where(and(
    eq(schema.subscriptionRequests.businessId, businessId),
    isNull(schema.subscriptionRequests.handledAt),
  )).orderBy(asc(schema.subscriptionRequests.requestedAt)).limit(1);
  return row ?? null;
}

/** Cria o pedido aberto ou devolve o que já existe. O índice parcial impede dois abertos. */
export async function openSubscriptionRequest(businessId: string, provider: SubscriptionProviderId, database: Database): Promise<OpenSubscriptionRequest> {
  const existing = await loadOpenSubscriptionRequest(businessId, database);
  if (existing) return existing;
  try {
    const [created] = await database.insert(schema.subscriptionRequests).values({ businessId, provider }).returning({
      id: schema.subscriptionRequests.id,
      requestedAt: schema.subscriptionRequests.requestedAt,
      provider: schema.subscriptionRequests.provider,
    });
    if (!created) throw new Error("Pedido de assinatura não foi gravado.");
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await loadOpenSubscriptionRequest(businessId, database);
    if (!raced) throw error;
    return raced;
  }
}
