import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses } from "../../db/schema";
import { onboardingResumeSchema, type OnboardingResume } from "./resume-contract";

type Database = Pick<ReturnType<typeof getDb>, "select">;

/**
 * Negócio mais recente do dono autenticado.
 * Não recebe id nem slug: esses valores não podem vir da URL.
 */
export async function resumeOwnedBusiness(ownerId: string, database: Database = getDb()): Promise<OnboardingResume | null> {
  const owner = z.string().min(1).parse(ownerId);
  const [row] = await database
    .select({ id: businesses.id, slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.ownerId, owner))
    .orderBy(desc(businesses.createdAt), desc(businesses.id))
    .limit(1);
  if (!row) return null;
  return onboardingResumeSchema.parse({
    businessId: row.id,
    slug: row.slug,
    publicPath: `/${row.slug}`,
  });
}
