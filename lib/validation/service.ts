import { z } from "zod";
import { depositPolicySchema, PADRAO_DEPOSIT_POLICY } from "../policy/schema";

// O limite acompanha a coluna integer do PostgreSQL.
export const centsSchema = z.number().int().min(0).max(2147483647);

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().positive().max(2147483647),
  priceCents: centsSchema,
  depositCents: centsSchema,
  depositPolicy: depositPolicySchema.default(PADRAO_DEPOSIT_POLICY),
}).strict().refine((value) => value.depositCents <= value.priceCents, {
  message: "O sinal não pode superar o preço do serviço.",
  path: ["depositCents"],
});
