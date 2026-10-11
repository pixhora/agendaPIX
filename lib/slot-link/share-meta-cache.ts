/** A prévia de compartilhamento não consulta o banco em toda visita do crawler. */
export const SHARE_META_TTL_MS = 60_000;
/** "Não achou" dura pouco: o token pode passar a existir e o mapa não pode encher de lixo. */
export const SHARE_META_NEGATIVE_TTL_MS = 5_000;
/** Tetos separados: token falso não expulsa prévia válida. */
export const SHARE_META_CACHE_MAX = 256;
export const SHARE_META_NEGATIVE_MAX = 256;

export type ShareMetaCacheEntry<T> = { at: number; value: T; negative?: boolean };

export function shareMetaCacheKey(slug: string, tokenHash: string) {
  return `${slug}:${tokenHash}`;
}

export function readShareMetaCache<T>(
  cache: Map<string, ShareMetaCacheEntry<T>>,
  key: string,
  now: number,
  ttl = SHARE_META_TTL_MS,
  negativeTtl = SHARE_META_NEGATIVE_TTL_MS,
) {
  const hit = cache.get(key);
  if (!hit) return null;
  const life = hit.negative ? negativeTtl : ttl;
  if (now - hit.at >= life) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function trimPolarity<T>(cache: Map<string, ShareMetaCacheEntry<T>>, negative: boolean, max: number) {
  const keys: string[] = [];
  for (const [key, entry] of cache) {
    if (Boolean(entry.negative) === negative) keys.push(key);
  }
  while (keys.length > max) {
    const oldest = keys.shift();
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function writeShareMetaCache<T>(
  cache: Map<string, ShareMetaCacheEntry<T>>,
  key: string,
  now: number,
  value: T,
  options?: { negative?: boolean; positiveMax?: number; negativeMax?: number },
) {
  const negative = options?.negative === true;
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { at: now, value, negative });
  trimPolarity(cache, false, options?.positiveMax ?? SHARE_META_CACHE_MAX);
  trimPolarity(cache, true, options?.negativeMax ?? SHARE_META_NEGATIVE_MAX);
}
