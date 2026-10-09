import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { rateLimitSecret } from "../env";
import { HttpError } from "../http";
import { bookingConfig, type BookingConfig } from "./config";

/** Remove porta/colchetes, normaliza IPv4 mapeado em IPv6 e agrupa IPv6 por /64 (um /64 é barato para um atacante). */
export function normalizeClientAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) value = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
  value = value.replace(/%.*$/, "").toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped) value = mapped[1];
  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return null;
  const [head, tail = ""] = value.split("::");
  const left = head ? head.split(":") : [];
  const right = value.includes("::") && tail ? tail.split(":") : [];
  const groups = value.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  if (groups.length !== 8 || groups.some((group) => group.includes("."))) return value;
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

function forwardedFor(request: Request) {
  return (request.headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Identifica o cliente para limites antiabuso. Retorna null quando não há identificação confiável;
 * nesse caso só os tetos por negócio se aplicam (nunca um balde único compartilhado por todos).
 *
 * - Com BOOKING_TRUST_PROXY=true: usa X-Real-IP, ou X-Forwarded-For pela regra "rightmost-trusted"
 *   (o N-ésimo item a partir da direita, N = BOOKING_TRUSTED_PROXY_HOPS, foi anexado pelo proxy de entrada).
 * - Sem proxy confiável: usa o último item de X-Forwarded-For. O Next preenche esse header com o endereço
 *   do socket quando ele está ausente; um cliente pode forjá-lo, mas isso só o divide em baldes próprios
 *   (o teto por negócio continua limitando o total) e não esgota o balde de outros clientes.
 */
export function bookingClientIdentity(request: Request, config: BookingConfig = bookingConfig()): string | null {
  if (config.BOOKING_TRUST_PROXY) {
    if (config.BOOKING_CLIENT_IP_HEADER === "x-real-ip") {
      const address = normalizeClientAddress(request.headers.get("x-real-ip"));
      return address ? `proxy:${address}` : null;
    }
    const entries = forwardedFor(request);
    const index = entries.length - config.BOOKING_TRUSTED_PROXY_HOPS;
    const address = index >= 0 ? normalizeClientAddress(entries[index]) : null;
    return address ? `proxy:${address}` : null;
  }
  const address = normalizeClientAddress(forwardedFor(request).at(-1));
  return address ? `peer:${address}` : null;
}

/** HMAC por negócio: o endereço nunca é armazenado e não correlaciona clientes entre negócios. */
export function tenantScopedHash(purpose: string, businessId: string, identity: string) {
  const secret = rateLimitSecret();
  if (!secret) throw new HttpError(503, "booking_unavailable", "Agendamento indisponível. Tente novamente mais tarde.");
  return createHmac("sha256", secret).update(`${purpose}:${businessId}:${identity}`).digest("hex");
}

const BUSINESS_BUCKET = "*business*";

async function consumeBucket(database: NodePgDatabase<typeof schema>, businessId: string, clientHash: string, limit: number) {
  const result = await database.execute(sql`INSERT INTO booking_rate_limits (business_id, client_hash, attempts)
    VALUES (${businessId}, ${clientHash}, 1)
    ON CONFLICT (business_id, client_hash) DO UPDATE SET
      attempts = CASE WHEN booking_rate_limits.window_started_at <= now() - interval '1 minute' THEN 1 ELSE booking_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN booking_rate_limits.window_started_at <= now() - interval '1 minute' THEN now() ELSE booking_rate_limits.window_started_at END
    WHERE booking_rate_limits.attempts < ${limit} OR booking_rate_limits.window_started_at <= now() - interval '1 minute'
    RETURNING attempts`);
  return result.rows.length > 0;
}

async function consumeWindow(database: NodePgDatabase<typeof schema>, businessId: string, identity: string | null, purpose: string, perClient: number, perBusiness: number, clientMessage: string, businessMessage: string) {
  // Limpeza limitada; a tabela guarda somente contadores descartáveis.
  await database.execute(sql`DELETE FROM booking_rate_limits WHERE window_started_at < now() - interval '24 hours' AND (business_id, client_hash) IN
    (SELECT business_id, client_hash FROM booking_rate_limits WHERE window_started_at < now() - interval '24 hours' LIMIT 100)`);
  // Balde do cliente primeiro: tentativas recusadas de um cliente não consomem o teto compartilhado do negócio.
  if (identity && !await consumeBucket(database, businessId, tenantScopedHash(purpose, businessId, identity), perClient)) {
    throw new HttpError(429, "rate_limited", clientMessage, 60);
  }
  if (!await consumeBucket(database, businessId, tenantScopedHash(purpose, businessId, BUSINESS_BUCKET), perBusiness)) {
    throw new HttpError(429, "rate_limited", businessMessage, 60);
  }
}

export async function consumeBookingRateLimit(database: NodePgDatabase<typeof schema>, businessId: string, identity: string | null, config: BookingConfig = bookingConfig()) {
  await consumeWindow(
    database, businessId, identity, "booking-rate:v1",
    config.BOOKING_RATE_LIMIT_PER_CLIENT, config.BOOKING_RATE_LIMIT_PER_BUSINESS,
    "Muitas tentativas. Aguarde um minuto e tente novamente.",
    "Muitas tentativas neste negócio. Aguarde um minuto e tente novamente.",
  );
}

/** Polling do Pix (a cada 4 s). Balde separado da criação de reserva, sem lock do negócio. */
export async function consumePaymentPollRateLimit(database: NodePgDatabase<typeof schema>, businessId: string, identity: string | null, config: BookingConfig = bookingConfig()) {
  await consumeWindow(
    database, businessId, identity, "payment-poll:v1",
    config.PAYMENT_POLL_RATE_LIMIT_PER_CLIENT, config.PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS,
    "Muitas consultas. Aguarde um minuto e tente novamente.",
    "Muitas consultas neste negócio. Aguarde um minuto e tente novamente.",
  );
}
