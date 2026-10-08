import { z } from "zod";
import { slugSchema } from "../bookings/validation";
import { serviceInputSchema } from "../validation/service";
import { contactWhatsappSchema } from "../validation/whatsapp";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const onboardingInputSchema = z.object({
  business: z.object({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema,
    timezone: z.string().refine((value) => {
      try { new Intl.DateTimeFormat("pt-BR", { timeZone: value }); return true; }
      catch { return false; }
    }).default("America/Sao_Paulo"),
    contactWhatsapp: contactWhatsappSchema.nullable().optional(),
  }).strict(),
  service: serviceInputSchema,
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: clock, closesAt: clock }).strict()
    .refine((value) => value.opensAt < value.closesAt)).min(1).max(7)
    .refine((values) => new Set(values.map((value) => value.weekday)).size === values.length)
    .transform((values) => values.sort((a, b) => a.weekday - b.weekday)),
}).strict();
