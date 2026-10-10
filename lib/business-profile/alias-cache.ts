const ALIAS_CACHE_TTL_MS = 60_000;
const ALIAS_CACHE_MAX = 256;

type AliasLookup = (slug: string) => Promise<string | null>;
type CacheEntry = { target: string | null; expiresAt: number };

const globalStore = globalThis as typeof globalThis & {
  __agendapixAliasCache?: Map<string, CacheEntry>;
};

/**
 * Proxy and route handlers are separate bundles. A module Map would keep a
 * negative entry in the proxy after PATCH deleted it in the other copy.
 */
function aliasCache() {
  return globalStore.__agendapixAliasCache ??= new Map<string, CacheEntry>();
}

export function clearAliasCache() {
  aliasCache().clear();
}

/** Drop one slug after this process changes it, including a release that must stop redirecting. */
export function invalidateAliasCache(slug: string) {
  aliasCache().delete(slug);
}

/**
 * Short memory for the old-slug lookup. A miss is stored too: an unknown slug
 * and a released alias (no redirect) must not hit the database on every request.
 * A thrown lookup is not stored, so a database error is tried again next time.
 */
export async function cachedAliasTarget(slug: string, lookup: AliasLookup, now = Date.now()): Promise<string | null> {
  const cache = aliasCache();
  const hit = cache.get(slug);
  if (hit && hit.expiresAt > now) {
    cache.delete(slug);
    cache.set(slug, hit);
    return hit.target;
  }
  if (hit) cache.delete(slug);
  const target = await lookup(slug);
  cache.set(slug, { target, expiresAt: now + ALIAS_CACHE_TTL_MS });
  while (cache.size > ALIAS_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return target;
}
