import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import type * as schema from "../../db/schema";
import { depositReversalAckResponseSchema } from "../contracts/deposit-status";
import { HttpError } from "../http";

type Database = NodePgDatabase<typeof schema>;

const inputSchema = z.object({
  ownerId: z.string().min(1),
  businessId: z.uuid(),
  bookingId: z.uuid(),
});

/**
 * Uma query só: a reserva pertence ao negócio e o negócio pertence à sessão.
 * Negócio cruzado, reserva de outro negócio ou sinal que não foi devolvido: 404.
 * A primeira vista permanece. Repetir não move a data.
 */
export async function acknowledgeDepositReversal(database: Database, input: { ownerId: string; businessId: string; bookingId: string }, now = new Date()) {
  const ids = inputSchema.parse(input);
  const result = await database.execute(sql`
    update bookings as b
    set deposit_reversal_seen_at = coalesce(b.deposit_reversal_seen_at, ${now.toISOString()}::timestamptz)
    from businesses as biz
    where b.id = ${ids.bookingId}::uuid
      and b.business_id = ${ids.businessId}::uuid
      and biz.id = b.business_id
      and biz.owner_id = ${ids.ownerId}
      and b.deposit_reversed_at is not null
    returning b.id as id, b.deposit_reversal_reason as reason, b.deposit_reversal_seen_at as seen_at
  `);
  const row = result.rows[0] as { id?: string; reason?: string; seen_at?: Date | string } | undefined;
  if (!row?.id || (row.reason !== "refunded" && row.reason !== "charged_back") || !row.seen_at) {
    throw new HttpError(404, "booking_not_found", "Agendamento não encontrado.");
  }
  const seenAt = row.seen_at instanceof Date ? row.seen_at : new Date(row.seen_at);
  return depositReversalAckResponseSchema.parse({
    bookingId: row.id,
    depositStatus: row.reason,
    depositReversalSeenAt: seenAt.toISOString(),
  });
}
