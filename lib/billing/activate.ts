import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import * as schema from "../../db/schema";
import { accessGrantingPeriodEnd } from "./access";
import { addCalendarMonths } from "./period";

type Database = NodePgDatabase<typeof schema>;

export type ActivationPlan = {
  dryRun: boolean;
  businessId: string;
  slug: string;
  provider: "manual";
  months: number;
  previousPeriodEnd: string | null;
  currentPeriodEnd: string;
  requestId: string | null;
  handledBy: string;
};

export function formatActivationLog(plan: ActivationPlan) {
  return JSON.stringify({
    event: plan.dryRun ? "subscription_activation_dry_run" : "subscription_activated",
    provider: plan.provider,
    businessId: plan.businessId,
    slug: plan.slug,
    months: plan.months,
    previousPeriodEnd: plan.previousPeriodEnd,
    currentPeriodEnd: plan.currentPeriodEnd,
    requestId: plan.requestId,
    handledBy: plan.handledBy,
  });
}

async function findBusiness(database: Pick<Database, "select">, ref: string) {
  const id = z.uuid().safeParse(ref);
  const [business] = id.success
    ? await database.select().from(schema.businesses).where(eq(schema.businesses.id, id.data)).limit(1)
    : await database.select().from(schema.businesses).where(eq(schema.businesses.slug, ref)).limit(1);
  if (!business) throw new Error("Negócio não encontrado.");
  return business;
}

function assertMonths(months: number) {
  if (!Number.isSafeInteger(months) || months < 1) throw new Error("--months precisa ser um inteiro maior ou igual a 1.");
}

export async function activateManualSubscription(
  database: Database,
  input: { business: string; months: number; by: string; dryRun: boolean },
  options: { now?: Date; log?: (line: string) => void } = {},
): Promise<ActivationPlan> {
  assertMonths(input.months);
  const operator = input.by.trim();
  if (!operator || operator.length > 120) throw new Error("Informe o operador com --by <operador>.");
  const now = options.now ?? new Date();
  const business = await findBusiness(database, input.business.trim());
  const log = options.log ?? ((line: string) => { process.stdout.write(`${line}\n`); });

  const planFrom = (previous: Date | null, requestId: string | null): ActivationPlan => ({
    dryRun: input.dryRun,
    businessId: business.id,
    slug: business.slug,
    provider: "manual",
    months: input.months,
    previousPeriodEnd: previous ? previous.toISOString() : null,
    currentPeriodEnd: addCalendarMonths(previous ?? now, input.months, business.timezone).toISOString(),
    requestId,
    handledBy: operator,
  });

  if (input.dryRun) {
    const [subscription] = await database.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, business.id)).limit(1);
    const [request] = await database.select({ id: schema.subscriptionRequests.id }).from(schema.subscriptionRequests).where(and(
      eq(schema.subscriptionRequests.businessId, business.id),
      isNull(schema.subscriptionRequests.handledAt),
    )).limit(1);
    const previous = accessGrantingPeriodEnd(subscription ?? null, now);
    const plan = planFrom(previous, request?.id ?? null);
    log(formatActivationLog(plan));
    return plan;
  }

  const plan = await database.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`subscription:${business.id}`}, 0))`);
    const [subscription] = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, business.id)).limit(1);
    const previous = accessGrantingPeriodEnd(subscription ?? null, now);
    const currentPeriodEnd = addCalendarMonths(previous ?? now, input.months, business.timezone);
    await tx.insert(schema.subscriptions).values({
      businessId: business.id,
      status: "active",
      provider: "manual",
      currentPeriodEnd,
    }).onConflictDoUpdate({
      target: schema.subscriptions.businessId,
      set: { status: "active", provider: "manual", currentPeriodEnd, updatedAt: now },
    });
    const [request] = await tx.update(schema.subscriptionRequests).set({
      handledAt: now,
      handledBy: operator,
    }).where(and(
      eq(schema.subscriptionRequests.businessId, business.id),
      isNull(schema.subscriptionRequests.handledAt),
    )).returning({ id: schema.subscriptionRequests.id });
    return planFrom(previous, request?.id ?? null);
  });
  log(formatActivationLog(plan));
  return plan;
}

export async function listOpenSubscriptionRequests(database: Pick<Database, "select">) {
  const rows = await database.select({
    id: schema.subscriptionRequests.id,
    businessId: schema.subscriptionRequests.businessId,
    slug: schema.businesses.slug,
    name: schema.businesses.name,
    provider: schema.subscriptionRequests.provider,
    requestedAt: schema.subscriptionRequests.requestedAt,
  }).from(schema.subscriptionRequests).innerJoin(
    schema.businesses,
    eq(schema.businesses.id, schema.subscriptionRequests.businessId),
  ).where(isNull(schema.subscriptionRequests.handledAt)).orderBy(asc(schema.subscriptionRequests.requestedAt));
  return rows.map((row) => ({ ...row, requestedAt: row.requestedAt.toISOString() }));
}
