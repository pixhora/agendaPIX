import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { businesses } from "../db/schema";

// ownerId deve vir da sessão validada, nunca do corpo enviado pelo cliente.
export async function findOwnedBusiness(businessId: string, ownerId: string, database: Pick<ReturnType<typeof getDb>, "select"> = getDb()) {
  const input = z.object({ businessId: z.uuid(), ownerId: z.string().min(1) }).parse({ businessId, ownerId });
  const [business] = await database.select().from(businesses).where(and(eq(businesses.id, input.businessId), eq(businesses.ownerId, input.ownerId))).limit(1);
  return business ?? null;
}
