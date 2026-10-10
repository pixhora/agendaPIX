import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businessSlugHistory, businesses } from "../../db/schema";
import { businessProfilePatchRequestSchema, businessProfileResponseSchema } from "../contracts";
import { publicBusinessPageUrl } from "../billing/public-url";
import { HttpError } from "../http";
import { publicBookingPagePath } from "../public-api";
import { findOwnedBusiness } from "../tenancy";
import { slugTakenError } from "./slug-conflict";

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
 * O dono pode recuperar um alias do próprio negócio: a linha sai do histórico
 * e o slug que ele deixa entra no lugar. Alias de outro negócio responde 409.
 */
export async function updateBusinessProfile(businessId: string, ownerId: string, body: unknown, database: Database = getDb()) {
  const parsed = businessProfilePatchRequestSchema.safeParse(body);
  if (!parsed.success) invalidInput(parsed.error);
  const id = z.uuid().safeParse(businessId);
  if (!id.success) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");

  try {
    return await database.transaction(async (tx) => {
      const business = await findOwnedBusiness(id.data, ownerId, tx);
      if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
      const nextName = parsed.data.name ?? business.name;
      const nextLogo = parsed.data.logoUrl === undefined ? business.logoUrl : parsed.data.logoUrl;
      const nextSlug = parsed.data.slug ?? business.slug;
      if (nextSlug === business.slug) {
        const [updated] = await tx.update(businesses).set({ name: nextName, logoUrl: nextLogo }).where(and(eq(businesses.id, business.id), eq(businesses.ownerId, ownerId))).returning();
        if (!updated) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
        return present(updated);
      }

      await lockSlugs(tx, [business.slug, nextSlug]);
      const [alias] = await tx.select({ businessId: businessSlugHistory.businessId }).from(businessSlugHistory).where(eq(businessSlugHistory.oldSlug, nextSlug)).limit(1);
      if (alias && alias.businessId !== business.id) {
        throw new HttpError(409, "slug_taken", "Esse endereço já está em uso. Escolha outro.", undefined, { details: { constraint: "slug_alias" } });
      }
      if (alias) await tx.delete(businessSlugHistory).where(and(eq(businessSlugHistory.oldSlug, nextSlug), eq(businessSlugHistory.businessId, business.id)));
      const [taken] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, nextSlug)).limit(1);
      if (taken && taken.id !== business.id) {
        throw new HttpError(409, "slug_taken", "Esse endereço já está em uso. Escolha outro.", undefined, { details: { constraint: "businesses_slug_unique" } });
      }

      const [updated] = await tx.update(businesses).set({
        name: nextName,
        slug: nextSlug,
        logoUrl: nextLogo,
      }).where(and(eq(businesses.id, business.id), eq(businesses.ownerId, ownerId), eq(businesses.slug, business.slug))).returning();
      if (!updated) throw new HttpError(409, "slug_taken", "Esse endereço já está em uso. Escolha outro.", undefined, { details: { constraint: "businesses_slug_unique" } });
      await tx.insert(businessSlugHistory).values({ oldSlug: business.slug, businessId: business.id });
      return present(updated);
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const conflict = slugTakenError(error);
    if (conflict) throw conflict;
    throw error;
  }
}
