import { z } from "zod";

// O limite acompanha a coluna integer do PostgreSQL.
export const centsSchema = z.number().int().min(0).max(2147483647);

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().positive().max(2147483647),
  priceCents: centsSchema,
  depositCents: centsSchema,
}).strict().refine((value) => value.depositCents <= value.priceCents, {
  message: "O sinal não pode superar o preço do serviço.",
  path: ["depositCents"],
});
