import { z } from "zod";
import { HttpError } from "../http";

const flag = z.enum(["true", "false"]).default("false").transform((value) => value === "true");
const int = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);
const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);

/**
 * Mercado Pago Payments API: `date_of_expiration` aceita de 30 minutos a 30 dias.
 * O hold da reserva usa a mesma faixa. O pedido soma 2 minutos de margem.
 * https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
 */
export const PIX_EXPIRATION_MIN_MINUTES = 30;
export const PIX_EXPIRATION_MAX_MINUTES = 30 * 24 * 60;

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
  BOOKING_HOLD_MINUTES: z.preprocess(blankAsUndefined, int(PIX_EXPIRATION_MIN_MINUTES, PIX_EXPIRATION_MAX_MINUTES, PIX_EXPIRATION_MIN_MINUTES)),
  BOOKING_MAX_PENDING_PER_CLIENT: z.preprocess(blankAsUndefined, int(1, 100, 3)),
  BOOKING_MAX_PENDING_PER_PHONE: z.preprocess(blankAsUndefined, int(1, 100, 2)),
  BOOKING_MAX_PENDING_PER_BUSINESS: z.preprocess(blankAsUndefined, int(1, 10000, 50)),
}).refine((value) => value.BOOKING_RATE_LIMIT_PER_BUSINESS >= value.BOOKING_RATE_LIMIT_PER_CLIENT, "O teto por negócio deve ser maior ou igual ao limite por cliente.");

export type BookingConfig = z.infer<typeof bookingEnvSchema>;

export function bookingConfig(env: Readonly<Record<string, string | undefined>> = process.env): BookingConfig {
  const parsed = bookingEnvSchema.safeParse(env);
  if (!parsed.success) throw new HttpError(503, "booking_unavailable", "Agendamento indisponível. Tente novamente mais tarde.");
  return parsed.data;
}
