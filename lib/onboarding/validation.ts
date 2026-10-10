import { z } from "zod";
import { businessNameSchema, businessSlugSchema } from "../contracts";
import { centsSchema } from "../validation/service";
import { contactWhatsappSchema } from "../validation/whatsapp";

export const STORE_DURATION_MINUTES = [15, 30, 45, 60, 90, 120] as const;

const storeDaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.boolean(),
  opensAt: z.string(),
  closesAt: z.string(),
});

/** Campos da etapa "Sua loja" que não estão no perfil (serviço, duração, sinal e dias). Nome, link e logo usam `lib/contracts`. */
export const storeProfileSchema = z.object({
  name: z.string(),
  slug: z.string(),
  serviceName: z.string(),
  durationMinutes: z.number(),
  priceCents: z.number(),
  depositEnabled: z.boolean(),
  depositCents: z.number(),
  days: z.array(storeDaySchema).length(7),
}).superRefine((value, ctx) => {
  const name = value.name.trim();
  if (name.length < 2 || name.length > 60) ctx.addIssue({ code: "custom", path: ["name"], message: "Digite o nome da sua loja." });
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

/** Sem `logoUrl`. A chave extra cai no `.strict()` e a rota responde 400. Só o POST da logo grava a coluna. */
export const onboardingInputSchema = z.object({
  business: z.object({
    name: businessNameSchema,
    slug: businessSlugSchema,
    timezone: timezoneSchema,
    contactWhatsapp: contactWhatsappSchema.nullable().optional(),
  }).strict(),
  service: onboardingServiceSchema,
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: clock, closesAt: clock }).strict()
    .refine((value) => value.opensAt < value.closesAt)).min(1).max(7)
    .refine((values) => new Set(values.map((value) => value.weekday)).size === values.length)
    .transform((values) => values.sort((a, b) => a.weekday - b.weekday)),
}).strict();
