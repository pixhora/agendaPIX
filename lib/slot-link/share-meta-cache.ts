/** A prévia de compartilhamento não consulta o banco em toda visita do crawler. */
export const SHARE_META_TTL_MS = 60_000;

export type ShareMetaCacheEntry<T> = { at: number; value: T };

export function shareMetaCacheKey(slug: string, tokenHash: string) {
  return `${slug}:${tokenHash}`;
}

export function readShareMetaCache<T>(cache: Map<string, ShareMetaCacheEntry<T>>, key: string, now: number, ttl = SHARE_META_TTL_MS) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at >= ttl) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function writeShareMetaCache<T>(cache: Map<string, ShareMetaCacheEntry<T>>, key: string, now: number, value: T) {
  cache.set(key, { at: now, value });
}
