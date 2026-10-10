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

const BRL_GROUPED = /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/;
const BRL_PLAIN = /^\d+(?:,\d{1,2})?$/;
const DOT_DECIMAL = /^\d+(?:\.\d{1,2})?$/;

/** Valor de campo em reais, com vírgula e separador de milhar. Sem símbolo. */
export function formatMoneyInput(cents: number) {
  const value = Math.trunc(cents);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100).toLocaleString("pt-BR");
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole},${fraction}`;
}

// Converte a representação decimal em centavos sem multiplicar floats.
export function parseMoney(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") throw new Error("Informe o valor em reais, com até duas casas decimais.");
  const text = value.trim();
  let whole: string;
  let decimal = "";
  if (text.includes(",")) {
    if (!BRL_GROUPED.test(text) && !BRL_PLAIN.test(text)) throw new Error("Informe o valor em reais, com até duas casas decimais.");
    const [rawWhole, rawDecimal = ""] = text.replaceAll(".", "").split(",");
    whole = rawWhole;
    decimal = rawDecimal;
  } else {
    if (!DOT_DECIMAL.test(text)) throw new Error("Informe o valor em reais, com até duas casas decimais.");
    [whole, decimal = ""] = text.split(".");
  }
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
