import { z } from "zod";
import { RESERVED_BUSINESS_SLUGS } from "../slug";
import { apiErrorBodySchema } from "./errors";

/**
 * Perfil real do negócio. Sem default e sem valor de exemplo.
 *
 * Prefixo do link (não criar env nova):
 * - origem canônica (metadata, sitemap): `NEXT_PUBLIC_SITE_URL` via `siteOrigin()`
 * - URL absoluta no servidor (WhatsApp, e-mail, checkout): `BETTER_AUTH_URL` via `publicBusinessPageUrl()`
 *
 * Alias ativo (`released_at` nulo): no máximo 3 por negócio, resposta 308.
 * O quarto troca libera o mais antigo (`released_at = now()`): para de redirecionar (404)
 * e segue bloqueado para os outros por 90 dias (`taken`). Depois disso o link fica livre.
 * O negócio de origem recupera o seu enquanto o bloqueio vale.
 * Troca de slug: 3 por 30 dias (`429 rate_limited` + `Retry-After`). Todo PATCH também tem teto por hora.
 * `logoUrl` não entra no PATCH. Só `POST /logo` grava a coluna.
 */

/** Mesma expressão de `slugSchema` e de `PUBLIC_SLUG` em `lib/slug.ts`. */
export const BUSINESS_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Limites de `isPublicSlug` em `lib/slug.ts`. */
export const BUSINESS_SLUG_MIN = 3;
export const BUSINESS_SLUG_MAX = 40;

export const BUSINESS_NAME_MIN = 2;
export const BUSINESS_NAME_MAX = 60;

/** Host público do Vercel Blob quando `put` usa `access: "public"`. */
export const VERCEL_BLOB_PUBLIC_SUFFIX = ".public.blob.vercel-storage.com";

/** Host do adaptador falso. Só vale fora de `NODE_ENV=production`. */
export const FAKE_BLOB_HOST = "blob.fake.local";

export const LOGO_UPLOAD_FIELD = "logo";
export const LOGO_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_UPLOAD_MAX_EDGE_PX = 512;

export const BUSINESS_PROFILE_PATH = "/api/businesses/[businessId]/profile";
export const BUSINESS_LOGO_PATH = "/api/businesses/[businessId]/logo";
export const SLUG_AVAILABILITY_PATH = "/api/public/slugs/availability";

const reservedSlugs = new Set<string>(RESERVED_BUSINESS_SLUGS);

export function isVercelBlobPublicHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (!host.endsWith(VERCEL_BLOB_PUBLIC_SUFFIX)) return false;
  const storeId = host.slice(0, -VERCEL_BLOB_PUBLIC_SUFFIX.length);
  return storeId.length > 0 && !storeId.includes(".");
}

export function logoUrlRejection(value: string, nodeEnv: string | undefined = process.env.NODE_ENV): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "logo_invalid";
  }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname.length <= 1) return "logo_invalid";
  if (isVercelBlobPublicHost(url.hostname)) return null;
  if (nodeEnv !== "production" && url.hostname.toLowerCase() === FAKE_BLOB_HOST) return null;
  return "logo_invalid";
}

export const businessNameSchema = z.string().trim().min(BUSINESS_NAME_MIN).max(BUSINESS_NAME_MAX);

export const businessSlugSchema = z
  .string()
  .trim()
  .min(BUSINESS_SLUG_MIN)
  .max(BUSINESS_SLUG_MAX)
  .regex(BUSINESS_SLUG_PATTERN)
  .refine((value) => !reservedSlugs.has(value), { message: "slug_reserved" });

/** Lê `NODE_ENV` na validação. Em produção o host falso é recusado. */
export const businessLogoUrlSchema = z.string().trim().min(1).superRefine((value, ctx) => {
  const reason = logoUrlRejection(value);
  if (reason) ctx.addIssue({ code: "custom", message: reason });
});

/** Perfil completo. A criação do negócio aceita logo ausente; este objeto não. */
export const businessProfileSchema = z.object({
  name: businessNameSchema,
  slug: businessSlugSchema,
  logoUrl: businessLogoUrlSchema,
}).strict();

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

/** PATCH parcial. Pelo menos um campo. Sem `logoUrl`: a logo só entra pelo POST do arquivo. */
export const businessProfilePatchRequestSchema = z.object({
  name: businessNameSchema.optional(),
  slug: businessSlugSchema.optional(),
}).strict().refine((value) => value.name !== undefined || value.slug !== undefined, {
  message: "nothing_to_update",
});

export type BusinessProfilePatchRequest = z.infer<typeof businessProfilePatchRequestSchema>;

/**
 * Resposta do PATCH e do perfil gravado.
 * `publicUrl` usa `BETTER_AUTH_URL` (`publicBusinessPageUrl`). Fica `null` se essa env faltar.
 * `logoUrl` é `null` enquanto o negócio não tiver logo.
 */
export const businessProfileResponseSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  logoUrl: z.string().nullable(),
  publicPath: z.string().min(1),
  publicUrl: z.string().nullable(),
}).strict();

export type BusinessProfileResponse = z.infer<typeof businessProfileResponseSchema>;

/** Resposta de POST do logo. A URL já passou no mesmo critério de `logoUrl`. */
export const logoUploadResponseSchema = z.object({
  logoUrl: businessLogoUrlSchema,
}).strict();

export type LogoUploadResponse = z.infer<typeof logoUploadResponseSchema>;

/**
 * `too_short` permanece: a tela de cadastro já distingue link curto de inválido.
 * `suggestions` vem vazio quando o link está livre, inválido ou curto.
 * Tomado ou reservado traz no máximo 3 alternativas.
 */
export const slugAvailabilityReasonSchema = z.enum(["taken", "reserved", "invalid", "too_short"]);

export type SlugAvailabilityReason = z.infer<typeof slugAvailabilityReasonSchema>;

export const slugAvailabilityResponseSchema = z.object({
  input: z.string(),
  normalized: z.string(),
  valid: z.boolean(),
  available: z.boolean(),
  reason: slugAvailabilityReasonSchema.nullable(),
  suggestions: z.array(z.string()).max(3),
}).strict().superRefine((value, ctx) => {
  const mustBeEmpty = value.available || value.reason === null || value.reason === "invalid" || value.reason === "too_short";
  if (mustBeEmpty && value.suggestions.length > 0) {
    ctx.addIssue({ code: "custom", message: "suggestions_must_be_empty", path: ["suggestions"] });
  }
});

export type SlugAvailabilityResponse = z.infer<typeof slugAvailabilityResponseSchema>;

export { apiErrorBodySchema };
