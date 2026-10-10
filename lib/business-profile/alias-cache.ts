const ALIAS_CACHE_TTL_MS = 60_000;
const ALIAS_CACHE_MAX = 256;

type AliasLookup = (slug: string) => Promise<string | null>;
type CacheEntry = { target: string | null; expiresAt: number };

const aliasCache = new Map<string, CacheEntry>();

export function clearAliasCache() {
  aliasCache.clear();
}

/**
 * Short memory for the old-slug lookup, including "not an alias".
 * A thrown lookup is not stored, so a database error is tried again next time.
 */
export async function cachedAliasTarget(slug: string, lookup: AliasLookup, now = Date.now()): Promise<string | null> {
  const hit = aliasCache.get(slug);
  if (hit && hit.expiresAt > now) {
    aliasCache.delete(slug);
    aliasCache.set(slug, hit);
    return hit.target;
  }
  if (hit) aliasCache.delete(slug);
  const target = await lookup(slug);
  aliasCache.set(slug, { target, expiresAt: now + ALIAS_CACHE_TTL_MS });
  while (aliasCache.size > ALIAS_CACHE_MAX) {
    const oldest = aliasCache.keys().next().value;
    if (oldest === undefined) break;
    aliasCache.delete(oldest);
  }
  return target;
}
