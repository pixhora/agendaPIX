export type SlugReason = "too_short" | "invalid" | "reserved" | "taken";

export type SlugAvailability = {
  input: string;
  normalized: string;
  valid: boolean;
  available: boolean;
  reason: SlugReason | null;
  suggestions: string[];
};

export type SlugCheckResult =
  | { ok: true; availability: SlugAvailability }
  | { ok: false; kind: "unverified" | "network" };

const REASONS = new Set<SlugReason>(["too_short", "invalid", "reserved", "taken"]);

export function parseSlugAvailability(body: unknown): SlugAvailability | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.normalized !== "string" || typeof record.valid !== "boolean" || typeof record.available !== "boolean") {
    return null;
  }
  const reason = record.reason === null || (typeof record.reason === "string" && REASONS.has(record.reason as SlugReason))
    ? (record.reason as SlugReason | null)
    : null;
  const suggestions = Array.isArray(record.suggestions)
    ? record.suggestions.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  return {
    input: typeof record.input === "string" ? record.input : record.normalized,
    normalized: record.normalized,
    valid: record.valid,
    available: record.available,
    reason,
    suggestions,
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function slugAvailabilityPath(slug: string, options?: { segment?: string | null; uf?: string | null }): string {
  const params = new URLSearchParams({ slug });
  if (options?.segment) params.set("segment", options.segment);
  const uf = options?.uf?.trim().toLowerCase();
  if (uf && /^[a-z]{2}$/.test(uf)) params.set("uf", uf);
  return `/api/public/slugs/availability?${params.toString()}`;
}

/** GET /api/public/slugs/availability. 404 and 5xx mean "could not check" and must not block. */
export async function fetchSlugAvailability(
  slug: string,
  signal: AbortSignal,
  options?: { segment?: string | null; uf?: string | null },
): Promise<SlugCheckResult> {
  let response: Response;
  try {
    response = await fetch(slugAvailabilityPath(slug, options), {
      method: "GET",
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    return { ok: false, kind: "network" };
  }
  if (response.status === 404 || response.status >= 500 || !response.ok) return { ok: false, kind: "unverified" };
  const body = await response.json().catch(() => null);
  const availability = parseSlugAvailability(body);
  if (!availability) return { ok: false, kind: "unverified" };
  return { ok: true, availability };
}

export function availableSlug(slug: string): SlugAvailability {
  return { input: slug, normalized: slug, valid: true, available: true, reason: null, suggestions: [] };
}

/**
 * In-memory check with a 60s cache. A newer call aborts the previous one
 * and an older response is ignored even if it arrives later.
 */
export class SlugAvailabilityClient {
  private generation = 0;
  private controller: AbortController | null = null;
  private readonly cache = new Map<string, { at: number; value: SlugAvailability }>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly fetchImpl: (slug: string, signal: AbortSignal) => Promise<SlugCheckResult> = fetchSlugAvailability,
  ) {}

  peek(slug: string): SlugAvailability | null {
    const hit = this.cache.get(slug);
    if (!hit) return null;
    if (this.now() - hit.at >= 60_000) {
      this.cache.delete(slug);
      return null;
    }
    return hit.value;
  }

  remember(slug: string, value: SlugAvailability) {
    this.cache.set(slug, { at: this.now(), value });
  }

  invalidate() {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }

  async check(slug: string): Promise<{ ignored: true } | { ignored: false; result: SlugCheckResult }> {
    const cached = this.peek(slug);
    if (cached) return { ignored: false, result: { ok: true, availability: cached } };
    this.controller?.abort();
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const result = await this.fetchImpl(slug, controller.signal);
      if (generation !== this.generation) return { ignored: true };
      if (result.ok) this.cache.set(slug, { at: this.now(), value: result.availability });
      return { ignored: false, result };
    } catch (error) {
      if (generation !== this.generation || isAbort(error)) return { ignored: true };
      return { ignored: false, result: { ok: false, kind: "network" } };
    }
  }
}
