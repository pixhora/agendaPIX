import { z } from "zod";
import { depositPolicySchema } from "../policy/schema";
import { centsSchema } from "../validation/service";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Escolha uma data válida.");
export const serviceFormSchema = z.object({
  businessId: z.uuid(), id: z.uuid().optional(), name: z.string().trim().min(1).max(120),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  priceCents: centsSchema, depositCents: centsSchema, active: z.boolean(),
  depositPolicy: depositPolicySchema.optional(),
}).strict().refine((value) => value.depositCents <= value.priceCents, { path: ["depositCents"], message: "O sinal não pode superar o preço." });
export const hoursSchema = z.array(z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).strict().refine((value) => value.opensAt < value.closesAt, "A abertura deve ser anterior ao fechamento.")).max(7)
  .refine((value) => new Set(value.map((day) => day.weekday)).size === value.length, "Dia repetido.");

// Converte a representação decimal em centavos sem multiplicar floats.
export function parseMoney(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || !/^\d+(?:[,.]\d{1,2})?$/.test(value.trim())) throw new Error("Informe o valor em reais, com até duas casas decimais.");
  const [whole, decimal = ""] = value.trim().replace(",", ".").split(".");
  return centsSchema.parse(Number(whole) * 100 + Number(decimal.padEnd(2, "0")));
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${dateSchema.parse(date)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function weekDates(date: string) {
  const weekday = new Date(`${dateSchema.parse(date)}T00:00:00Z`).getUTCDay();
  const monday = shiftDate(date, -(weekday + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
export type FormState = { error?: string; success?: string };
