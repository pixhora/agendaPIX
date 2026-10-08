import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { businessPixKeys, ownerNotices } from "../../db/schema";

export const PIX_KEY_RETIRED_NOTICE = "pix_key_retired";
export const PIX_KEY_DEACTIVATION_REASON = "pix_key_retired";

type NoticeDatabase = Pick<ReturnType<typeof getDb>, "select" | "insert">;

/**
 * true só quando existe chave Pix antiga já inativa e o dono ainda não dispensou o aviso.
 * A consulta não lê ciphertext, tipo nem hint.
 */
export async function hasUndismissedLegacyPixKey(businessId: string, database: NoticeDatabase = getDb()) {
  const [key] = await database.select({ businessId: businessPixKeys.businessId }).from(businessPixKeys).where(and(
    eq(businessPixKeys.businessId, businessId),
    isNotNull(businessPixKeys.deactivatedAt),
  )).limit(1);
  if (!key) return false;
  const [notice] = await database.select({ businessId: ownerNotices.businessId }).from(ownerNotices).where(and(
    eq(ownerNotices.businessId, businessId),
    eq(ownerNotices.kind, PIX_KEY_RETIRED_NOTICE),
    isNull(ownerNotices.bookingId),
  )).limit(1);
  return !notice;
}

/** Idempotente. Não altera dismissed_at se o aviso já foi dispensado. */
export async function dismissLegacyPixKeyNotice(businessId: string, database: NoticeDatabase = getDb()) {
  await database.insert(ownerNotices).values({ businessId, kind: PIX_KEY_RETIRED_NOTICE }).onConflictDoNothing({
    target: [ownerNotices.businessId, ownerNotices.kind],
    where: sql`${ownerNotices.bookingId} IS NULL`,
  });
}
