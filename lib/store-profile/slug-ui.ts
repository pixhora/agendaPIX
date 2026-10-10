import { isPublicSlug, normalizeSlug, RESERVED_BUSINESS_SLUGS } from "@/lib/slug";

const reserved = new Set<string>(RESERVED_BUSINESS_SLUGS);

export const SLUG_COPY = {
  checking: "Verificando…",
  available: "Disponível",
  taken: "Esse link já está em uso. Tente outro.",
  reserved: "Esse link é reservado pelo sistema. Escolha outro.",
  invalid: "Use de 3 a 40 letras, números ou hífens.",
  error: "Não deu para verificar agora.",
  rateLimited: "Muitas tentativas. Espere um pouco e tente de novo.",
} as const;

export type SlugUiStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid" | "error";

export type SlugView = {
  status: SlugUiStatus;
  message: string | null;
  suggestions: string[];
};

function takenSuggestions(suggestions: string[] | undefined): string[] {
  return (suggestions ?? []).map((item) => item.trim()).filter((item) => item.length > 0).slice(0, 2);
}

/** Maps the live check to the four statuses plus a network error. Suggestions only when the server sent some. */
export function slugView(input: {
  slug: string;
  phase: "idle" | "checking" | "ready" | "error" | "rate_limited";
  available?: boolean;
  reason?: "taken" | "reserved" | "invalid" | "too_short" | null;
  suggestions?: string[];
  forcedTaken?: boolean;
  owned?: boolean;
}): SlugView {
  if (input.owned) return { status: "available", message: SLUG_COPY.available, suggestions: [] };
  if (input.forcedTaken) return { status: "taken", message: SLUG_COPY.taken, suggestions: takenSuggestions(input.suggestions) };
  const finalSlug = normalizeSlug(input.slug, { final: true });
  if (!finalSlug) return { status: "idle", message: null, suggestions: [] };
  if (!isPublicSlug(finalSlug)) return { status: "invalid", message: SLUG_COPY.invalid, suggestions: [] };
  if (reserved.has(finalSlug)) return { status: "reserved", message: SLUG_COPY.reserved, suggestions: [] };
  if (input.phase === "checking") return { status: "checking", message: SLUG_COPY.checking, suggestions: [] };
  if (input.phase === "rate_limited") return { status: "error", message: SLUG_COPY.rateLimited, suggestions: [] };
  if (input.phase === "error") return { status: "error", message: SLUG_COPY.error, suggestions: [] };
  if (input.phase !== "ready") return { status: "checking", message: SLUG_COPY.checking, suggestions: [] };
  if (input.reason === "reserved") return { status: "reserved", message: SLUG_COPY.reserved, suggestions: [] };
  if (input.reason === "invalid" || input.reason === "too_short") return { status: "invalid", message: SLUG_COPY.invalid, suggestions: [] };
  if (input.available && !input.reason) return { status: "available", message: SLUG_COPY.available, suggestions: [] };
  if (input.reason === "taken" || input.available === false) {
    return { status: "taken", message: SLUG_COPY.taken, suggestions: takenSuggestions(input.suggestions) };
  }
  return { status: "error", message: SLUG_COPY.error, suggestions: [] };
}
