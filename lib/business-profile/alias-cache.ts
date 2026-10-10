const ALIAS_CACHE_TTL_MS = 60_000;
const ALIAS_CACHE_MAX = 256;

type AliasLookup = (slug: string) => Promise<string | null>;
type CacheEntry = { target: string; expiresAt: number };

/**
 * O proxy e as rotas são bundles diferentes. O Map no módulo não é o mesmo.
 * `globalThis` é o processo, então o PATCH apaga o alias que o proxy guardou.
 */
const globalStore = globalThis as typeof globalThis & { __agendaAliasCache?: Map<string, CacheEntry> };
const aliasCache = globalStore.__agendaAliasCache ??= new Map<string, CacheEntry>();

export function clearAliasCache() {
  aliasCache.clear();
}

/** Drop one slug after this process changes it, including a release that must stop redirecting. */
export function invalidateAliasCache(slug: string) {
  aliasCache.delete(slug);
}

/**
 * Short memory for an old slug that still redirects.
 * Only a positive alias is stored. A miss is not: the slug may be the live
 * store, and another instance can rename it without clearing this cache.
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
  if (!target) return target;
  aliasCache.set(slug, { target, expiresAt: now + ALIAS_CACHE_TTL_MS });
  while (aliasCache.size > ALIAS_CACHE_MAX) {
    const oldest = aliasCache.keys().next().value;
    if (oldest === undefined) break;
    aliasCache.delete(oldest);
  }
  return target;
}
