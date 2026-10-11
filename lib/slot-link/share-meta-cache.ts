/** A prévia de compartilhamento não consulta o banco em toda visita do crawler. */
export const SHARE_META_TTL_MS = 60_000;
/** "Não achou" dura pouco: o token pode passar a existir e o mapa não pode encher de lixo. */
export const SHARE_META_NEGATIVE_TTL_MS = 5_000;
/** Teto do mapa. A leitura recoloca a chave no fim (LRU). */
export const SHARE_META_CACHE_MAX = 256;

export type ShareMetaCacheEntry<T> = { at: number; value: T; negative?: boolean };

export function shareMetaCacheKey(slug: string, tokenHash: string) {
  return `${slug}:${tokenHash}`;
}

export function readShareMetaCache<T>(cache: Map<string, ShareMetaCacheEntry<T>>, key: string, now: number, ttl = SHARE_META_TTL_MS) {
  const hit = cache.get(key);
  if (!hit) return null;
  const life = hit.negative ? SHARE_META_NEGATIVE_TTL_MS : ttl;
  if (now - hit.at >= life) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

export function writeShareMetaCache<T>(
  cache: Map<string, ShareMetaCacheEntry<T>>,
  key: string,
  now: number,
  value: T,
  options?: { negative?: boolean; max?: number },
) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { at: now, value, negative: options?.negative === true });
  const max = options?.max ?? SHARE_META_CACHE_MAX;
  while (cache.size > max) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
