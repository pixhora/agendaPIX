/** Shared by the onboarding UI and the backend (`@/lib/slug`). */
export type NormalizeSlugOptions = { final: boolean };

/**
 * System paths that cannot be a public page.
 * `precos`, `ajuda`, `suporte` and `blog` are part of the v2 list.
 */
export const RESERVED_BUSINESS_SLUGS = [
  "login",
  "onboarding",
  "preview",
  "dashboard",
  "api",
  "admin",
  "auth",
  "health",
  "ready",
  "webhooks",
  "_next",
  "static",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
  "manifest.webmanifest",
  "termos",
  "privacidade",
  "contato",
  "exemplo",
  "entrar",
  "precos",
  "ajuda",
  "suporte",
  "blog",
] as const;

const MARKS = /\p{M}+/gu;
const SEPARATORS = /[\s_.&+/\\,;:]+/g;
const REJECTED = /[^a-z0-9-]/g;

/**
 * Turns free text into a public link.
 * A trailing hyphen is kept while the person is still typing (`final: false`)
 * and removed on blur, continue and submit (`final: true`).
 */
export function normalizeSlug(raw: string, opts: NormalizeSlugOptions): string {
  const base = raw
    .normalize("NFD")
    .replace(MARKS, "")
    .toLowerCase()
    .replace(SEPARATORS, "-")
    .replace(REJECTED, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);
  return opts.final ? base.replace(/-+$/, "") : base;
}

/** Final form used by older callers. Prefer `normalizeSlug`. */
export function slugify(text: string): string {
  return normalizeSlug(text, { final: true });
}

const PUBLIC_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isPublicSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && PUBLIC_SLUG.test(slug);
}

/**
 * Value and caret after an in-progress edit.
 * The caret stays at the end of the normalized prefix, so it does not jump
 * to the end of the field when the text shrinks.
 */
export function slugFromRawEdit(rawValue: string, caretInRaw: number): { value: string; caret: number } {
  const value = normalizeSlug(rawValue, { final: false });
  const caret = normalizeSlug(rawValue.slice(0, Math.max(0, caretInRaw)), { final: false }).length;
  return { value, caret: Math.min(caret, value.length) };
}
