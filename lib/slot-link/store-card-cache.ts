import { readShareMetaCache, writeShareMetaCache, type ShareMetaCacheEntry } from "./share-meta-cache";

/** Nome e logo por instância. 90 s se a loja existe; slug desconhecido sai em 30 s. */
export const STORE_CARD_TTL_MS = 90_000;
export const STORE_CARD_NEGATIVE_TTL_MS = 30_000;
export const STORE_CARD_CACHE_MAX = 256;

export type StoreCard = { businessName: string; logoUrl: string | null; missing?: boolean };

const storeCardCache = new Map<string, ShareMetaCacheEntry<StoreCard>>();

export function clearStoreCardCache() {
  storeCardCache.clear();
}

/** O dono trocou nome, slug ou logo: a prévia não pode ficar com o cartão velho. */
export function forgetStoreCard(slug: string) {
  storeCardCache.delete(slug);
}

export async function rememberedStoreCard(slug: string, now: number, load: (slug: string) => Promise<StoreCard>) {
  const cached = readShareMetaCache(storeCardCache, slug, now, STORE_CARD_TTL_MS, STORE_CARD_NEGATIVE_TTL_MS);
  if (cached) return cached;
  const card = await load(slug);
  writeShareMetaCache(storeCardCache, slug, now, card, {
    negative: card.missing === true,
    positiveMax: STORE_CARD_CACHE_MAX,
    negativeMax: STORE_CARD_CACHE_MAX,
  });
  return card;
}
