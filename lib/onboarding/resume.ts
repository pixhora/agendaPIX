import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses } from "../../db/schema";
import { onboardingResumeSchema, type OnboardingResume, type ResumeTarget } from "./resume-contract";

type Database = Pick<ReturnType<typeof getDb>, "select">;

/**
 * Negócio do userId da sessão. A query filtra por esse dono.
 * Se a URL pede um id ou slug, a linha também precisa ser desse dono; a de outro não volta.
 * Seleciona só id e slug: sem CPF e sem token OAuth.
 */
export async function resumeOwnedBusiness(ownerId: string, database: Database = getDb(), target: ResumeTarget = {}): Promise<OnboardingResume | null> {
  if ("reject" in target) return null;
  const owner = z.string().min(1).parse(ownerId);
  const filters: SQL[] = [eq(businesses.ownerId, owner)];
  if (target.businessId) filters.push(eq(businesses.id, target.businessId));
  if (target.slug) filters.push(eq(businesses.slug, target.slug));
  const [row] = await database
    .select({ id: businesses.id, slug: businesses.slug })
    .from(businesses)
    .where(and(...filters))
    .orderBy(desc(businesses.createdAt), desc(businesses.id))
    .limit(1);
  if (!row) return null;
  return onboardingResumeSchema.parse({
    businessId: row.id,
    slug: row.slug,
    publicPath: `/${row.slug}`,
  });
}
