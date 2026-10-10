import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businessSlugHistory, businesses } from "../../db/schema";
import { consumeAbuseBucket } from "../abuse-rate-limit";
import { businessProfilePatchRequestSchema, businessProfileResponseSchema } from "../contracts";
import { publicBusinessPageUrl } from "../billing/public-url";
import { HttpError } from "../http";
import { publicBookingPagePath } from "../public-api";
import { findOwnedBusiness } from "../tenancy";
import { invalidateAliasCache } from "./alias-cache";
import { isUniqueViolation, rejectTakenSlug } from "./slug-conflict";
import { ACTIVE_ALIAS_CAP, aliasHoldActive, PROFILE_PATCH_LIMIT, SLUG_CHANGE_LIMIT } from "./slug-policy";

type Database = ReturnType<typeof getDb>;

function invalidInput(error: z.ZodError): never {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (!fields[path]) fields[path] = issue.message === "slug_reserved" ? "Esse nome é reservado." : issue.message;
  }
  throw new HttpError(400, "invalid_input", "Confira os dados enviados.", undefined, { details: { fields } });
}

function present(row: { id: string; name: string; slug: string; logoUrl: string | null }) {
  return businessProfileResponseSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    publicPath: publicBookingPagePath(row.slug),
    publicUrl: publicBusinessPageUrl(row.slug),
  });
}

async function lockSlugs(database: Pick<Database, "execute">, slugs: string[]) {
  for (const slug of [...new Set(slugs)].sort()) {
    await database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${slug}, 481516))`);
  }
}

/**
 * The owner can take back their own alias while it is held: that row leaves the
 * history and the slug they abandon takes its place. Another business's held
 * alias is 409. A released alias older than 90 days is deleted and becomes free.
 * Slug changes are limited to 3 per 30 days. Every PATCH also counts toward the hourly cap.
 */
export async function updateBusinessProfile(businessId: string, ownerId: string, body: unknown, database: Database = getDb()) {
  const parsed = businessProfilePatchRequestSchema.safeParse(body);
  if (!parsed.success) invalidInput(parsed.error);
  const id = z.uuid().safeParse(businessId);
  if (!id.success) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  const existing = await findOwnedBusiness(id.data, ownerId, database);
  if (!existing) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  await consumeAbuseBucket("profile-patch", ownerId, PROFILE_PATCH_LIMIT, "hour", database);

  const dropped: string[] = [];
  try {
    const result = await database.transaction(async (tx) => {
      const business = await findOwnedBusiness(id.data, ownerId, tx);
      if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
      const nextName = parsed.data.name ?? business.name;
      const nextSlug = parsed.data.slug ?? business.slug;
      if (nextSlug === business.slug) {
        const [updated] = await tx.update(businesses).set({ name: nextName }).where(and(eq(businesses.id, business.id), eq(businesses.ownerId, ownerId))).returning();
        if (!updated) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
        return present(updated);
      }

      await consumeAbuseBucket("profile-slug", ownerId, SLUG_CHANGE_LIMIT, "day30", tx);
      await lockSlugs(tx, [business.slug, nextSlug]);
      const [alias] = await tx.select({
        businessId: businessSlugHistory.businessId,
        releasedAt: businessSlugHistory.releasedAt,
      }).from(businessSlugHistory).where(eq(businessSlugHistory.oldSlug, nextSlug)).limit(1);
      if (alias && aliasHoldActive(alias.releasedAt) && alias.businessId !== business.id) {
        await rejectTakenSlug(database, nextSlug, "slug_alias");
      }
      if (alias) await tx.delete(businessSlugHistory).where(eq(businessSlugHistory.oldSlug, nextSlug));
      const [taken] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, nextSlug)).limit(1);
      if (taken && taken.id !== business.id) {
        await rejectTakenSlug(database, nextSlug, "businesses_slug_unique", "slug_conflict_retry");
      }

      const active = await tx.select({ oldSlug: businessSlugHistory.oldSlug }).from(businessSlugHistory).where(and(
        eq(businessSlugHistory.businessId, business.id),
        isNull(businessSlugHistory.releasedAt),
      )).orderBy(asc(businessSlugHistory.createdAt), asc(businessSlugHistory.oldSlug));
      let releasedSlug: string | undefined;
      if (active.length >= ACTIVE_ALIAS_CAP) {
        const oldest = active[0]?.oldSlug;
        if (oldest) {
          releasedSlug = oldest;
          await lockSlugs(tx, [oldest]);
          await tx.update(businessSlugHistory).set({ releasedAt: new Date() }).where(and(
            eq(businessSlugHistory.oldSlug, oldest),
            eq(businessSlugHistory.businessId, business.id),
          ));
        }
      }

      const [updated] = await tx.update(businesses).set({
        name: nextName,
        slug: nextSlug,
      }).where(and(eq(businesses.id, business.id), eq(businesses.ownerId, ownerId), eq(businesses.slug, business.slug))).returning();
      if (!updated) await rejectTakenSlug(database, nextSlug, "businesses_slug_unique", "slug_conflict_retry");
      await tx.insert(businessSlugHistory).values({ oldSlug: business.slug, businessId: business.id });
      dropped.push(business.slug, nextSlug);
      if (releasedSlug) dropped.push(releasedSlug);
      return present(updated);
    });
    for (const slug of dropped) invalidateAliasCache(slug);
    return result;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error) && parsed.data.slug) await rejectTakenSlug(database, parsed.data.slug, "slug", "slug_conflict_retry");
    throw error;
  }
}
