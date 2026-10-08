import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { getBookingAccess, type SubscriptionAccess } from "./access";

type Reader = Pick<NodePgDatabase<typeof schema>, "select">;

export async function loadSubscription(businessId: string, database: Reader): Promise<SubscriptionAccess | null> {
  const [row] = await database.select({
    status: schema.subscriptions.status,
    currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
    provider: schema.subscriptions.provider,
  }).from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId)).limit(1);
  if (!row) return null;
  return { status: row.status, currentPeriodEnd: row.currentPeriodEnd, provider: row.provider };
}

export async function loadBookingAccess(
  business: { id: string; trialEndsAt: Date; timezone: string },
  database: Reader,
  now = new Date(),
) {
  const subscription = await loadSubscription(business.id, database);
  return { ...getBookingAccess(business, subscription, now), subscription };
}
