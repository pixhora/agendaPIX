import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { isReservedBusinessSlug } from "./bookings/validation";
import { normalizeSlug } from "./slug";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Sufixos citados em 03 §12.2b. Segmentos sem palavra na spec não ganham sufixo inventado. */
const SEGMENT_SUFFIX: Record<string, string> = {
  barbearia: "barber",
  unhas: "nails",
  cilios: "lash",
  estetica: "estetica",
  tattoo: "tattoo",
  personal: "personal",
};

export const ONBOARDING_SEGMENTS = ["barbearia", "salao", "unhas", "cilios", "estetica", "tattoo", "personal", "saude", "outro"] as const;

export type SlugReason = "too_short" | "invalid" | "reserved" | "taken";

export type SlugAvailability = {
  input: string;
  normalized: string;
  valid: boolean;
  available: boolean;
  reason: SlugReason | null;
  suggestions: string[];
};

export function classifySlug(raw: string): Omit<SlugAvailability, "suggestions"> {
  const normalized = normalizeSlug(raw, { final: true });
  const formatOk = SLUG_PATTERN.test(normalized);
  if (!normalized || !formatOk) return { input: raw, normalized, valid: false, available: false, reason: "invalid" };
  if (normalized.length < 3) return { input: raw, normalized, valid: false, available: false, reason: "too_short" };
  if (isReservedBusinessSlug(normalized)) return { input: raw, normalized, valid: false, available: false, reason: "reserved" };
  return { input: raw, normalized, valid: true, available: true, reason: null };
}

function pushCandidate(list: string[], slug: string, value: string) {
  const normalized = normalizeSlug(value, { final: true });
  if (!normalized || normalized === slug || normalized.length < 3 || normalized.length > 40) return;
  if (!SLUG_PATTERN.test(normalized) || isReservedBusinessSlug(normalized) || list.includes(normalized)) return;
  list.push(normalized);
}

/** Ordem da spec: segmento, sem hífen, UF, depois -2, -3… */
export function suggestionCandidates(slug: string, options?: { segment?: string | null; uf?: string | null }) {
  const list: string[] = [];
  const suffix = options?.segment ? SEGMENT_SUFFIX[options.segment] : undefined;
  if (suffix) pushCandidate(list, slug, `${slug}-${suffix}`);
  pushCandidate(list, slug, slug.replace(/-/g, ""));
  const uf = options?.uf?.trim().toLowerCase();
  if (uf && /^[a-z]{2}$/.test(uf)) pushCandidate(list, slug, `${slug}-${uf}`);
  for (let index = 2; index <= 12; index += 1) pushCandidate(list, slug, `${slug}-${index}`);
  return list;
}

/** Uma consulta só: slug atual e alias. Sugestão ocupada por qualquer um dos dois sai da lista. */
export async function takenSlugs(candidates: string[], database: Pick<ReturnType<typeof getDb>, "execute"> = getDb()) {
  if (!candidates.length) return new Set<string>();
  const current = sql.join(candidates.map((candidate) => sql`${candidate}`), sql`, `);
  const aliases = sql.join(candidates.map((candidate) => sql`${candidate}`), sql`, `);
  const result = await database.execute(sql`SELECT slug FROM businesses WHERE slug IN (${current})
    UNION
    SELECT old_slug AS slug FROM business_slug_history
    WHERE old_slug IN (${aliases})
      AND (released_at IS NULL OR released_at > now() - interval '90 days')`);
  return new Set((result.rows as { slug: string }[]).map((row) => row.slug));
}

export async function suggestFreeSlugs(slug: string, segment: string | null, database: Pick<ReturnType<typeof getDb>, "execute"> = getDb(), uf?: string | null) {
  const candidates = suggestionCandidates(slug, { segment, uf });
  const taken = await takenSlugs(candidates, database);
  return candidates.filter((candidate) => !taken.has(candidate)).slice(0, 3);
}

/** Uma ida ao banco confere o link pedido e os candidatos. */
export async function slugAvailability(raw: string, options: { segment?: string | null; uf?: string | null }, database: ReturnType<typeof getDb> = getDb()): Promise<SlugAvailability> {
  const assessed = classifySlug(raw);
  if (assessed.reason === "invalid" || assessed.reason === "too_short") return { ...assessed, suggestions: [] };
  const candidates = suggestionCandidates(assessed.normalized, options);
  const taken = await takenSlugs([assessed.normalized, ...candidates], database);
  const suggestions = candidates.filter((candidate) => !taken.has(candidate)).slice(0, 3);
  if (assessed.reason === "reserved") return { ...assessed, suggestions };
  if (taken.has(assessed.normalized)) return { ...assessed, valid: true, available: false, reason: "taken", suggestions };
  return { ...assessed, suggestions: [] };
}
