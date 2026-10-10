import { z } from "zod";
import { slugSchema } from "../bookings/validation";
import { serviceInputSchema } from "../validation/service";
import { contactWhatsappSchema } from "../validation/whatsapp";

/** Resposta de GET /api/public/slugs/availability. O formato novo é `{ available, reason, suggestions }`; o atual também manda `input`, `normalized` e `valid`. */
export const slugAvailabilityReasonSchema = z.enum(["taken", "reserved", "invalid", "too_short"]);

export const slugAvailabilityWireSchema = z.object({
  available: z.boolean(),
  reason: slugAvailabilityReasonSchema.nullable().optional(),
  suggestions: z.array(z.string()).max(12).optional(),
  input: z.string().optional(),
  normalized: z.string().optional(),
  valid: z.boolean().optional(),
});

export const STORE_DURATION_MINUTES = [15, 30, 45, 60, 90, 120] as const;

const storeDaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.boolean(),
  opensAt: z.string(),
  closesAt: z.string(),
});

/** Cadastro da loja. O cliente valida com este contrato; o servidor continua no `onboardingInputSchema` até o backend adotar as mesmas frases. */
export const storeProfileSchema = z.object({
  name: z.string(),
  slug: z.string(),
  serviceName: z.string(),
  durationMinutes: z.number(),
  priceCents: z.number(),
  depositEnabled: z.boolean(),
  depositCents: z.number(),
  days: z.array(storeDaySchema).length(7),
  logoUrl: z.union([z.string().trim().url(), z.null()]),
}).superRefine((value, ctx) => {
  const name = value.name.trim();
  if (!name || name.length > 60) ctx.addIssue({ code: "custom", path: ["name"], message: "Digite o nome da sua loja." });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) || value.slug.length < 3 || value.slug.length > 40) {
    ctx.addIssue({ code: "custom", path: ["slug"], message: "Use de 3 a 40 letras, números ou hífens." });
  }
  if (!value.serviceName.trim()) ctx.addIssue({ code: "custom", path: ["serviceName"], message: "Digite o nome do serviço." });
  if (!STORE_DURATION_MINUTES.includes(value.durationMinutes as (typeof STORE_DURATION_MINUTES)[number])) {
    ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "Escolha a duração." });
  }
  if (!Number.isInteger(value.priceCents) || value.priceCents <= 0) {
    ctx.addIssue({ code: "custom", path: ["priceCents"], message: "Digite o preço." });
  }
  if (value.depositEnabled && (!Number.isInteger(value.depositCents) || value.depositCents <= 0 || value.depositCents > value.priceCents)) {
    ctx.addIssue({ code: "custom", path: ["depositCents"], message: "O sinal não pode ser maior que o preço." });
  }
  const open = value.days.filter((day) => day.open);
  if (!open.length) ctx.addIssue({ code: "custom", path: ["days"], message: "Abra pelo menos um dia." });
  for (const day of open) {
    const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!clock.test(day.opensAt) || !clock.test(day.closesAt) || day.opensAt >= day.closesAt) {
      ctx.addIssue({ code: "custom", path: ["days", String(day.weekday)], message: "Fim deve ser depois do início." });
    }
  }
});

export type StoreProfileInput = z.infer<typeof storeProfileSchema>;

/** `HH:mm` ou `HH:mm:ss` (campo `type=time`). O valor guardado fica `HH:mm`. */
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).transform((value) => value.slice(0, 5));
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
