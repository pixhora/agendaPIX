import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { businessSlugHistory, businesses } from "../../db/schema";
import { isReservedBusinessSlug } from "../bookings/validation";
import { isPublicSlug } from "../slug";
import { cachedAliasTarget, type PublicAliasClass } from "./alias-cache";

export class SlugMoved extends Error {
  constructor(public slug: string) {
    super("slug_moved");
  }
}

type Database = Pick<ReturnType<typeof getDb>, "select">;

/** Leitura direta. Não passa pelo cache de 60s. */
export async function readAliasTarget(slug: string, database: Database): Promise<string | null> {
  if (!isPublicSlug(slug) || isReservedBusinessSlug(slug)) return null;
  const [row] = await database
    .select({ slug: businesses.slug })
    .from(businessSlugHistory)
    .innerJoin(businesses, eq(businesses.id, businessSlugHistory.businessId))
    .where(and(eq(businessSlugHistory.oldSlug, slug), isNull(businessSlugHistory.releasedAt)))
    .limit(1);
  if (!row || row.slug === slug) return null;
  return row.slug;
}

/**
 * Slug atual quando `slug` é um alias ativo. Sem alias devolve null e não
 * entra no cache: um slug vivo pode mudar de nome em outra instância.
 */
export async function aliasTarget(slug: string, database: Database = getDb()): Promise<string | null> {
  return cachedAliasTarget(slug, (value) => readAliasTarget(value, database));
}

/** Alias, slug vivo ou inexistente. O vivo não pode ser cacheado. `getDb` só roda no miss. */
export async function classifyPublicAlias(
  slug: string,
  lookup: (slug: string) => Promise<string | null>,
  database?: Database,
): Promise<PublicAliasClass> {
  const target = await lookup(slug);
  if (target) return { alias: target };
  const db = database ?? getDb();
  const [row] = await db.select({ slug: businesses.slug }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
  return row ? "live" : "absent";
}

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Rotas públicas que não são página de um negócio.
 * `slugs/availability` é o consultor de link; o `[slug]` estático do Next ganha dele.
 */
const PUBLIC_API_EXACT = new Set(["/api/public/config", "/api/public/slugs/availability"]);

/** Página `/{slug}` e subcaminhos, ou `/api/public/{slug}/...`. Reservados não consultam o banco. */
export function publicSlugFromPath(pathname: string): string | null {
  if (PUBLIC_API_EXACT.has(pathname) || pathname.startsWith("/api/public/config/")) return null;
  const parts = pathname.split("/");
  if (parts[1] === "api" && parts[2] === "public" && parts[3]) {
    const slug = decodeSegment(parts[3]);
    return isPublicSlug(slug) && !isReservedBusinessSlug(slug) ? slug : null;
  }
  if (parts[1] === "api" || !parts[1]) return null;
  const slug = decodeSegment(parts[1]);
  return isPublicSlug(slug) && !isReservedBusinessSlug(slug) ? slug : null;
}

/** Location relativa. Troca só o segmento do negócio e preserva subcaminho e query. */
export function locationForMovedSlug(requestUrl: string, fromSlug: string, toSlug: string) {
  const url = new URL(requestUrl);
  const parts = url.pathname.split("/");
  const index = parts[1] === "api" && parts[2] === "public" ? 3 : 1;
  if (decodeSegment(parts[index] ?? "") !== fromSlug) return `${url.pathname}${url.search}`;
  parts[index] = encodeURIComponent(toSlug);
  return `${parts.join("/")}${url.search}`;
}

export function slugMovedResponse(requestUrl: string, fromSlug: string, toSlug: string) {
  const location = locationForMovedSlug(requestUrl, fromSlug, toSlug);
  return new Response(null, {
    status: 308,
    headers: {
      Location: location,
      // 308 é permanente, mas o dono pode recuperar o alias. Sem cache, o link volta a abrir.
      "Cache-Control": "no-store",
    },
  });
}

export function bookingRedirectPath(slug: string, search: Record<string, string | string[] | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  const query = params.toString();
  return `/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`;
}
