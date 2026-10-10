import { z } from "zod";
import { SLOT_LINK_TTL_DEFAULT_MINUTES, SLOT_LINK_TTL_MAX_MINUTES, SLOT_LINK_TTL_MIN_MINUTES } from "../contracts/slot-link";
import { HttpError } from "../http";

const flag = z.enum(["true", "false"]).default("false").transform((value) => value === "true");
const int = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);
const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);

/**
 * Mercado Pago Payments API: `date_of_expiration` aceita de 30 minutos a 30 dias.
 * O pedido soma 2 minutos ao hold, então o hold mínimo é 28 (28 + 2 = 30).
 * O padrão do hold continua 30.
 * https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
 */
export const PIX_EXPIRATION_MIN_MINUTES = 30;
export const PIX_EXPIRATION_MARGIN_MINUTES = 2;
export const BOOKING_HOLD_MIN_MINUTES = PIX_EXPIRATION_MIN_MINUTES - PIX_EXPIRATION_MARGIN_MINUTES;
export const BOOKING_HOLD_DEFAULT_MINUTES = 30;
export const PIX_EXPIRATION_MAX_MINUTES = 30 * 24 * 60;
export const BOOKING_HOLD_RANGE_MESSAGE = "BOOKING_HOLD_MINUTES inválido. Use de 28 a 43200 minutos. O Pix do Mercado Pago precisa de pelo menos 30 minutos (hold + 2).";
export const SLOT_LINK_TTL_RANGE_MESSAGE = "SLOT_LINK_TTL_MINUTES inválido. Use de 15 a 10080 minutos.";

/**
 * Configuração antiabuso das reservas públicas. Lida a cada chamada para refletir o ambiente atual
 * (e permitir testes); valores inválidos tornam o agendamento indisponível em vez de cair em padrões silenciosos.
 */
export const bookingEnvSchema = z.object({
  BOOKING_TRUST_PROXY: z.preprocess(blankAsUndefined, flag),
  BOOKING_CLIENT_IP_HEADER: z.preprocess(blankAsUndefined, z.enum(["x-real-ip", "x-forwarded-for"]).default("x-real-ip")),
  BOOKING_TRUSTED_PROXY_HOPS: z.preprocess(blankAsUndefined, int(1, 10, 1)),
  BOOKING_RATE_LIMIT_PER_CLIENT: z.preprocess(blankAsUndefined, int(1, 1000, 10)),
  BOOKING_RATE_LIMIT_PER_BUSINESS: z.preprocess(blankAsUndefined, int(1, 100000, 120)),
  BOOKING_HOLD_MINUTES: z.preprocess(blankAsUndefined, int(BOOKING_HOLD_MIN_MINUTES, PIX_EXPIRATION_MAX_MINUTES, BOOKING_HOLD_DEFAULT_MINUTES)),
  BOOKING_MAX_PENDING_PER_CLIENT: z.preprocess(blankAsUndefined, int(1, 100, 3)),
  BOOKING_MAX_PENDING_PER_PHONE: z.preprocess(blankAsUndefined, int(1, 100, 2)),
  BOOKING_MAX_PENDING_PER_BUSINESS: z.preprocess(blankAsUndefined, int(1, 10000, 50)),
  // Consulta do Pix a cada 4 s = 15/min. 120 cabe essa cadência, outra aba e o botão de verificar.
  PAYMENT_POLL_RATE_LIMIT_PER_CLIENT: z.preprocess(blankAsUndefined, int(1, 100000, 120)),
  // 50 sinais pendentes × 15/min = 750. 2400 deixa folga e ainda corta rajada no negócio.
  PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS: z.preprocess(blankAsUndefined, int(1, 100000, 2400)),
  // Link de um horário. O expiresAt gravado também nunca passa do início do horário.
  SLOT_LINK_TTL_MINUTES: z.preprocess(blankAsUndefined, int(SLOT_LINK_TTL_MIN_MINUTES, SLOT_LINK_TTL_MAX_MINUTES, SLOT_LINK_TTL_DEFAULT_MINUTES)),
  SLOT_LINK_CREATE_PER_OWNER: z.preprocess(blankAsUndefined, int(1, 1000, 30)),
  SLOT_LINK_OPEN_PER_CLIENT: z.preprocess(blankAsUndefined, int(1, 10000, 60)),
  SLOT_LINK_OPEN_PER_BUSINESS: z.preprocess(blankAsUndefined, int(1, 100000, 600)),
  SLOT_LINK_PAY_PER_CLIENT: z.preprocess(blankAsUndefined, int(1, 1000, 10)),
  SLOT_LINK_PAY_PER_TOKEN: z.preprocess(blankAsUndefined, int(1, 100, 5)),
  SLOT_LINK_PAY_PER_BUSINESS: z.preprocess(blankAsUndefined, int(1, 100000, 120)),
}).superRefine((value, ctx) => {
  if (value.BOOKING_RATE_LIMIT_PER_BUSINESS < value.BOOKING_RATE_LIMIT_PER_CLIENT) {
    ctx.addIssue({ code: "custom", path: ["BOOKING_RATE_LIMIT_PER_BUSINESS"], message: "invalid" });
    ctx.addIssue({ code: "custom", path: ["BOOKING_RATE_LIMIT_PER_CLIENT"], message: "invalid" });
  }
  if (value.PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS < value.PAYMENT_POLL_RATE_LIMIT_PER_CLIENT) {
    ctx.addIssue({ code: "custom", path: ["PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS"], message: "invalid" });
    ctx.addIssue({ code: "custom", path: ["PAYMENT_POLL_RATE_LIMIT_PER_CLIENT"], message: "invalid" });
  }
  if (value.SLOT_LINK_OPEN_PER_BUSINESS < value.SLOT_LINK_OPEN_PER_CLIENT) {
    ctx.addIssue({ code: "custom", path: ["SLOT_LINK_OPEN_PER_BUSINESS"], message: "invalid" });
    ctx.addIssue({ code: "custom", path: ["SLOT_LINK_OPEN_PER_CLIENT"], message: "invalid" });
  }
  if (value.SLOT_LINK_PAY_PER_BUSINESS < value.SLOT_LINK_PAY_PER_CLIENT || value.SLOT_LINK_PAY_PER_BUSINESS < value.SLOT_LINK_PAY_PER_TOKEN) {
    ctx.addIssue({ code: "custom", path: ["SLOT_LINK_PAY_PER_BUSINESS"], message: "invalid" });
    ctx.addIssue({ code: "custom", path: ["SLOT_LINK_PAY_PER_CLIENT"], message: "invalid" });
    ctx.addIssue({ code: "custom", path: ["SLOT_LINK_PAY_PER_TOKEN"], message: "invalid" });
  }
});

const bookingEnvKeys = new Set([
  "BOOKING_TRUST_PROXY",
  "BOOKING_CLIENT_IP_HEADER",
  "BOOKING_TRUSTED_PROXY_HOPS",
  "BOOKING_RATE_LIMIT_PER_CLIENT",
  "BOOKING_RATE_LIMIT_PER_BUSINESS",
  "BOOKING_HOLD_MINUTES",
  "BOOKING_MAX_PENDING_PER_CLIENT",
  "BOOKING_MAX_PENDING_PER_PHONE",
  "BOOKING_MAX_PENDING_PER_BUSINESS",
  "PAYMENT_POLL_RATE_LIMIT_PER_CLIENT",
  "PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS",
  "SLOT_LINK_TTL_MINUTES",
  "SLOT_LINK_CREATE_PER_OWNER",
  "SLOT_LINK_OPEN_PER_CLIENT",
  "SLOT_LINK_OPEN_PER_BUSINESS",
  "SLOT_LINK_PAY_PER_CLIENT",
  "SLOT_LINK_PAY_PER_TOKEN",
  "SLOT_LINK_PAY_PER_BUSINESS",
]);

/** Nome da env, sem o valor configurado. */
export function bookingConfigMessage(error: z.ZodError) {
  const names = new Set<string>();
  for (const issue of error.issues) {
    for (const part of issue.path) {
      if (typeof part === "string" && bookingEnvKeys.has(part)) names.add(part);
    }
  }
  if (names.size === 1 && names.has("BOOKING_HOLD_MINUTES")) return BOOKING_HOLD_RANGE_MESSAGE;
  if (names.size === 1 && names.has("SLOT_LINK_TTL_MINUTES")) return SLOT_LINK_TTL_RANGE_MESSAGE;
  const listed = [...names].sort().join(", ");
  if (!listed) return "Agendamento indisponível. Tente novamente mais tarde.";
  return `${listed} inválido. Agendamento indisponível. Tente novamente mais tarde.`;
}

export type BookingConfig = z.infer<typeof bookingEnvSchema>;

export function bookingConfig(env: Readonly<Record<string, string | undefined>> = process.env): BookingConfig {
  const parsed = bookingEnvSchema.safeParse(env);
  if (!parsed.success) throw new HttpError(503, "booking_unavailable", bookingConfigMessage(parsed.error));
  return parsed.data;
}
