import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businesses } from "@/db/schema";
import { isReservedBusinessSlug } from "@/lib/bookings/validation";
import { bookingRedirectPath, readAliasTarget } from "@/lib/business-profile/public-slug";
import { isPublicSlug } from "@/lib/slug";

function searchRecord(header: string | null) {
  const record: Record<string, string> = {};
  if (!header) return record;
  const params = new URLSearchParams(header.startsWith("?") ? header.slice(1) : header);
  for (const [key, value] of params) record[key] = value;
  return record;
}

/**
 * Fora do `loading.tsx`. O skeleton da página só entra depois que o slug existe,
 * senão o Next já mandou 200 e o `notFound()` não muda o status.
 */
export default async function PublicBusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isPublicSlug(slug) || isReservedBusinessSlug(slug)) notFound();
  const database = getDb();
  const [business] = await database.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!business) {
    const moved = await readAliasTarget(slug, database);
    if (moved) {
      const search = searchRecord((await headers()).get("x-agenda-search"));
      permanentRedirect(bookingRedirectPath(moved, search));
    }
    notFound();
  }
  return children;
}
