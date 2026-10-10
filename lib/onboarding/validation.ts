import { z } from "zod";
import { businessLogoUrlSchema, businessNameSchema, businessSlugSchema } from "../contracts";
import { centsSchema } from "../validation/service";
import { contactWhatsappSchema } from "../validation/whatsapp";

/** `HH:mm` ou `HH:mm:ss` (campo `type=time`). O valor guardado fica `HH:mm`. */
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).transform((value) => value.slice(0, 5));

const timezoneSchema = z.string().refine((value) => {
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: value }); return true; }
  catch { return false; }
});

/** Serviço do cadastro. Sem política padrão inventada aqui: o banco grava a política da coluna se o cliente não mandar. */
const onboardingServiceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().positive().max(2147483647),
  priceCents: centsSchema,
  depositCents: centsSchema,
}).strict().refine((value) => value.depositCents <= value.priceCents, {
  message: "O sinal não pode superar o preço do serviço.",
  path: ["depositCents"],
});

export const onboardingInputSchema = z.object({
  business: z.object({
    name: businessNameSchema,
    slug: businessSlugSchema,
    logoUrl: businessLogoUrlSchema,
    timezone: timezoneSchema,
    contactWhatsapp: contactWhatsappSchema.nullable().optional(),
  }).strict(),
  service: onboardingServiceSchema,
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: clock, closesAt: clock }).strict()
    .refine((value) => value.opensAt < value.closesAt)).min(1).max(7)
    .refine((values) => new Set(values.map((value) => value.weekday)).size === values.length)
    .transform((values) => values.sort((a, b) => a.weekday - b.weekday)),
}).strict();
