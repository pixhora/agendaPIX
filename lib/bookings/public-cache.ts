import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { businesses } from "../../db/schema";

export const PUBLIC_CATALOG_REVALIDATE_SECONDS = 30;

export function publicCatalogTag(slug: string) {
  return `public-catalog:${slug}`;
}

/** Some a tag do catálogo público. Fora do Next (testes) não faz nada e não lê o banco. */
export async function invalidatePublicCatalog(slug: string) {
  if (!process.env.NEXT_RUNTIME) return;
  const { revalidateTag } = await import("next/cache");
  revalidateTag(publicCatalogTag(slug), { expire: 0 });
}

export async function invalidatePublicCatalogForBusiness(businessId: string, database?: Pick<ReturnType<typeof getDb>, "select">) {
  if (!process.env.NEXT_RUNTIME) return;
  const db = database ?? getDb();
  const [row] = await db.select({ slug: businesses.slug }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (row) await invalidatePublicCatalog(row.slug);
}
