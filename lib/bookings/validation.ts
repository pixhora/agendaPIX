import { z } from "zod";
import { cpfDigits, isValidCpf } from "../validation/cpf";
import { RESERVED_BUSINESS_SLUGS } from "../slug";

export { RESERVED_BUSINESS_SLUGS };

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
    /**
     * Aceito só por compatibilidade com clientes antigos. O Orders API não exige CPF para Pix
     * (`payer.identification` é só de boleto). Não é persistido nem enviado ao Mercado Pago.
     */
    cpfCnpj: z.string().trim().min(11).max(18).transform(cpfDigits).refine(isValidCpf, "CPF inválido.").optional(),
  }).strict(),
  policyHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export const requestKeySchema = z.uuid({ version: "v4" });
