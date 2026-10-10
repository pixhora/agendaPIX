import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { readSlotLinkPreview } from "@/lib/bookings/slot-link";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { isSlotLinkToken, slotLinkTokenHash } from "@/lib/bookings/slot-link-token";
import { slotLinkOgCopy, parseSlotLinkPreview, GENERIC_OG_FALLBACK } from "./preview";
import { slotLinkOgImagePath } from "./paths";

export type SlotLinkShareMeta = { title: string; description: string; image: string | null };

/** Metadados da página. O token não volta no título, na descrição nem na URL da imagem. */
export async function slotLinkShareMeta(slug: string, token: string): Promise<SlotLinkShareMeta> {
  const fallback = { ...slotLinkOgCopy(GENERIC_OG_FALLBACK), image: null };
  if (!isSlotLinkToken(token)) return fallback;
  try {
    const database = getDb();
    const [row] = await database
      .select({ previewId: schema.slotLinks.previewId })
      .from(schema.slotLinks)
      .innerJoin(schema.businesses, eq(schema.businesses.id, schema.slotLinks.businessId))
      .where(and(eq(schema.slotLinks.tokenHash, slotLinkTokenHash(token)), eq(schema.businesses.slug, slug)))
      .limit(1);
    if (!row) return fallback;
    const requestHeaders = await headers();
    const identity = bookingClientIdentity(new Request("https://agendapix.local/", { headers: requestHeaders }));
    const raw: unknown = await readSlotLinkPreview(row.previewId, identity, database);
    const copy = slotLinkOgCopy(parseSlotLinkPreview(raw));
    return { ...copy, image: slotLinkOgImagePath(row.previewId) };
  } catch {
    return fallback;
  }
}
