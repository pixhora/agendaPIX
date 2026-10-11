import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { abuseBucketExhausted, consumeAbuseBucket } from "@/lib/abuse-rate-limit";
import { readSlotLinkPreview } from "@/lib/bookings/slot-link";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { bookingConfig } from "@/lib/bookings/config";
import { isSlotLinkToken, slotLinkTokenHash } from "@/lib/bookings/slot-link-token";
import { slotLinkOgCopy, parseSlotLinkPreview, GENERIC_OG_FALLBACK, type SlotLinkPreviewView } from "./preview";
import { slotLinkOgImagePath } from "./paths";
import { readShareMetaCache, shareMetaCacheKey, writeShareMetaCache, type ShareMetaCacheEntry } from "./share-meta-cache";
import { clearStoreCardCache, rememberedStoreCard, type StoreCard } from "./store-card-cache";

export type SlotLinkShareMeta = { title: string; description: string; image: string | null };

/**
 * Mesmo escopo do `probeLimit` da prévia (`slot-link-preview`).
 * Sem identidade não usamos o balde global `*global*`: cada pedido sem IP
 * divide um balde próprio, separado dos `peer:` / `proxy:`.
 */
export const SHARE_META_PROBE_SCOPE = "slot-link-preview";
export const SHARE_META_NO_IDENTITY = "metadata-no-identity";

const shareMetaCache = new Map<string, ShareMetaCacheEntry<SlotLinkShareMeta>>();

export function shareMetaBucketIdentity(identity: string | null | undefined) {
  if (typeof identity === "string" && identity.length > 0) return identity;
  return SHARE_META_NO_IDENTITY;
}

export function clearShareMetaCache() {
  shareMetaCache.clear();
  clearStoreCardCache();
}

export function shareMetaCacheRecord(slug: string, token: string) {
  if (!isSlotLinkToken(token)) return null;
  return shareMetaCache.get(shareMetaCacheKey(slug, slotLinkTokenHash(token))) ?? null;
}

export type SlotLinkShareMetaOptions = {
  identity?: string | null;
  database?: Parameters<typeof abuseBucketExhausted>[4];
  limit?: number;
  onTokenSelect?: () => void;
  probeExhausted?: typeof abuseBucketExhausted;
  probeConsume?: typeof consumeAbuseBucket;
  findToken?: (slug: string, tokenHash: string) => Promise<{ previewId: string } | null>;
  readPreview?: (previewId: string, identity: string | null) => Promise<SlotLinkPreviewView>;
  storeCard?: (slug: string) => Promise<StoreCard>;
};

function genericMeta(card: StoreCard): SlotLinkShareMeta {
  const copy = slotLinkOgCopy({ kind: "generic", businessName: card.businessName, logoUrl: card.logoUrl });
  return { ...copy, image: card.logoUrl };
}

async function defaultStoreCard(database: NonNullable<SlotLinkShareMetaOptions["database"]>, slug: string): Promise<StoreCard> {
  const missing = { businessName: GENERIC_OG_FALLBACK.businessName, logoUrl: GENERIC_OG_FALLBACK.logoUrl, missing: true };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return missing;
  const [business] = await database
    .select({ name: schema.businesses.name, logoUrl: schema.businesses.logoUrl })
    .from(schema.businesses)
    .where(eq(schema.businesses.slug, slug))
    .limit(1);
  if (!business) return missing;
  return { businessName: business.name, logoUrl: business.logoUrl, missing: false };
}

async function defaultFindToken(database: NonNullable<SlotLinkShareMetaOptions["database"]>, slug: string, tokenHash: string) {
  const [row] = await database
    .select({ previewId: schema.slotLinks.previewId })
    .from(schema.slotLinks)
    .innerJoin(schema.businesses, eq(schema.businesses.id, schema.slotLinks.businessId))
    .where(and(eq(schema.slotLinks.tokenHash, tokenHash), eq(schema.businesses.slug, slug)))
    .limit(1);
  return row ?? null;
}

/** Metadados da página. O token não volta no título, na descrição nem na URL da imagem. */
export async function slotLinkShareMeta(slug: string, token: string, now = Date.now(), options: SlotLinkShareMetaOptions = {}): Promise<SlotLinkShareMeta> {
  const tokenOk = isSlotLinkToken(token);
  if (tokenOk) {
    const cached = readShareMetaCache(shareMetaCache, shareMetaCacheKey(slug, slotLinkTokenHash(token)), now);
    if (cached) return cached;
  }
  const database = options.database ?? getDb();
  const identity = "identity" in options
    ? options.identity ?? null
    : bookingClientIdentity(new Request("https://agendapix.local/", { headers: await headers() }));
  const limit = options.limit ?? bookingConfig().SLOT_LINK_OPEN_PER_CLIENT;
  const bucket = shareMetaBucketIdentity(identity);
  const probeExhausted = options.probeExhausted ?? abuseBucketExhausted;
  const probeConsume = options.probeConsume ?? consumeAbuseBucket;
  const findToken = options.findToken ?? ((storeSlug, tokenHash) => defaultFindToken(database, storeSlug, tokenHash));
  const readPreview = options.readPreview ?? ((previewId, who) => readSlotLinkPreview(previewId, who, database as never, bookingConfig(), { probe: false }));
  const loadStoreCard = options.storeCard ?? ((storeSlug: string) => defaultStoreCard(database, storeSlug));
  const fallback = async () => genericMeta(await rememberedStoreCard(slug, now, loadStoreCard));

  if (!tokenOk) return fallback();
  const tokenHash = slotLinkTokenHash(token);
  const cacheKey = shareMetaCacheKey(slug, tokenHash);

  let exhausted = false;
  try {
    exhausted = await probeExhausted(SHARE_META_PROBE_SCOPE, bucket, limit, "minute", database);
  } catch {
    console.warn("slot-link: não deu para ler o limite da prévia");
    return fallback();
  }
  if (exhausted) return fallback();

  let row: { previewId: string } | null = null;
  try {
    options.onTokenSelect?.();
    row = await findToken(slug, tokenHash);
  } catch {
    return fallback();
  }
  if (!row) {
    try {
      await probeConsume(SHARE_META_PROBE_SCOPE, bucket, limit, "minute", database);
    } catch {
      // A janela fechou entre a leitura e o consumo. O genérico segue valendo.
    }
    const meta = await fallback();
    writeShareMetaCache(shareMetaCache, cacheKey, now, meta, { negative: true });
    return meta;
  }

  try {
    const raw = parseSlotLinkPreview(await readPreview(row.previewId, identity));
    const copy = slotLinkOgCopy(raw);
    const meta = { ...copy, image: raw.kind === "slot" ? slotLinkOgImagePath(row.previewId) : raw.logoUrl };
    writeShareMetaCache(shareMetaCache, cacheKey, now, meta);
    return meta;
  } catch {
    return fallback();
  }
}
