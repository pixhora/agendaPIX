import { z } from "zod";
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
}).refine((value) => value.BOOKING_RATE_LIMIT_PER_BUSINESS >= value.BOOKING_RATE_LIMIT_PER_CLIENT, "O teto por negócio deve ser maior ou igual ao limite por cliente.");

export type BookingConfig = z.infer<typeof bookingEnvSchema>;

export function bookingConfig(env: Readonly<Record<string, string | undefined>> = process.env): BookingConfig {
  const parsed = bookingEnvSchema.safeParse(env);
  if (!parsed.success) {
    const hold = parsed.error.issues.some((issue) => issue.path.includes("BOOKING_HOLD_MINUTES"));
    throw new HttpError(503, "booking_unavailable", hold ? BOOKING_HOLD_RANGE_MESSAGE : "Agendamento indisponível. Tente novamente mais tarde.");
  }
  return parsed.data;
}
