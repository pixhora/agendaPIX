const ALIAS_CACHE_TTL_MS = 60_000;
const ALIAS_CACHE_MAX = 256;
/** Slug que não está em `businesses`. Curto de propósito: não serve para um slug vivo. */
export const ABSENT_ALIAS_TTL_MS = 5_000;
const ABSENT_ALIAS_MAX = 256;
/** Rajada no proxy. Estouro segue sem redirect e sem gravar o resultado. */
export const ALIAS_LOOKUP_LIMIT = 80;
const ALIAS_LOOKUP_WINDOW_MS = 1_000;

type AliasLookup = (slug: string) => Promise<string | null>;
type CacheEntry = { target: string; expiresAt: number };
type AbsentEntry = { expiresAt: number };
export type PublicAliasClass = "live" | "absent" | { alias: string };

/**
 * O proxy e as rotas são bundles diferentes. O Map no módulo não é o mesmo.
 * `globalThis` é o processo, então o PATCH apaga o alias que o proxy guardou.
 */
const globalStore = globalThis as typeof globalThis & {
  __agendaAliasCache?: Map<string, CacheEntry>;
  __agendaAbsentAliasCache?: Map<string, AbsentEntry>;
};
const aliasCache = globalStore.__agendaAliasCache ??= new Map<string, CacheEntry>();
const absentCache = globalStore.__agendaAbsentAliasCache ??= new Map<string, AbsentEntry>();
let lookupWindow = { start: 0, count: 0 };

function dropOldest<T>(cache: Map<string, T>, max: number) {
  while (cache.size > max) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function clearAliasCache() {
  aliasCache.clear();
  absentCache.clear();
  lookupWindow = { start: 0, count: 0 };
}

/**
 * Drop one slug in this process after it is renamed, claimed by a new store, or released.
 * Clears the positive alias and the short absent entry. Both maps live on `globalThis`,
 * so the route bundle and the proxy bundle drop the same key.
 */
export function invalidateAliasCache(slug: string) {
  aliasCache.delete(slug);
  absentCache.delete(slug);
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
  dropOldest(aliasCache, ALIAS_CACHE_MAX);
  return target;
}

function takeLookup(now: number) {
  if (now - lookupWindow.start >= ALIAS_LOOKUP_WINDOW_MS) {
    lookupWindow = { start: now, count: 1 };
    return true;
  }
  if (lookupWindow.count >= ALIAS_LOOKUP_LIMIT) return false;
  lookupWindow.count += 1;
  return true;
}

/**
 * Proxy path. A live business slug is never stored: another instance can rename
 * it and the next request must 308 immediately. An unknown slug is remembered
 * only for a few seconds. Past the per-second cap, the lookup is skipped and
 * nothing is stored.
 */
export async function boundedAliasTarget(
  slug: string,
  classify: (slug: string) => Promise<PublicAliasClass>,
  now = Date.now(),
): Promise<string | null> {
  const hit = aliasCache.get(slug);
  if (hit && hit.expiresAt > now) {
    aliasCache.delete(slug);
    aliasCache.set(slug, hit);
    return hit.target;
  }
  if (hit) aliasCache.delete(slug);
  const absent = absentCache.get(slug);
  if (absent && absent.expiresAt > now) return null;
  if (absent) absentCache.delete(slug);
  if (!takeLookup(now)) return null;
  const result = await classify(slug);
  if (typeof result === "object") {
    aliasCache.set(slug, { target: result.alias, expiresAt: now + ALIAS_CACHE_TTL_MS });
    dropOldest(aliasCache, ALIAS_CACHE_MAX);
    return result.alias;
  }
  if (result === "absent") {
    absentCache.set(slug, { expiresAt: now + ABSENT_ALIAS_TTL_MS });
    dropOldest(absentCache, ABSENT_ALIAS_MAX);
  }
  return null;
}
