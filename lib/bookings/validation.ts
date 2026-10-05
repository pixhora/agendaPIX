import { z } from "zod";
import { cpfDigits, isValidCpf } from "../validation/cpf";

/** Slugs de sistema / rotas reservados; fonte única de verdade (comparação case-insensitive). */
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
] as const;

const reservedSlugSet = new Set<string>(RESERVED_BUSINESS_SLUGS.map((slug) => slug.toLowerCase()));

export function isReservedBusinessSlug(slug: string) {
  return reservedSlugSet.has(slug.toLowerCase());
}

export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .refine((value) => !isReservedBusinessSlug(value), { message: "slug_reserved" });

export const availabilitySchema = z.object({ serviceId: z.uuid(), date: z.iso.date() }).strict();
export const bookingInputSchema = z.object({
  serviceId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
    /** CPF do pagador (obrigatório para cobrança Pix / Asaas). Aceita máscara; normaliza para 11 dígitos. */
    cpfCnpj: z.string().trim().min(11).max(18).transform(cpfDigits).refine(isValidCpf, "CPF inválido."),
  }).strict(),
}).strict();
export const requestKeySchema = z.uuid({ version: "v4" });
