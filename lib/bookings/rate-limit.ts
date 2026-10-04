import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { authEnvSchema } from "../env";
import { HttpError } from "../http";

export function bookingClientIdentity(request: Request) {
  const address = request.headers.get("x-real-ip");
  return process.env.BOOKING_TRUST_PROXY === "true" && address && isIP(address) ? address : "anonymous";
}

export async function consumeBookingRateLimit(database: NodePgDatabase<typeof schema>, businessId: string, identity: string) {
  const env = authEnvSchema.safeParse(process.env);
  if (!env.success) throw new HttpError(503, "booking_unavailable", "Agendamento indisponível. Tente novamente mais tarde.");
  const clientHash = createHmac("sha256", env.data.BETTER_AUTH_SECRET).update(`booking-rate:v1:${businessId}:${identity}`).digest("hex");
  // Limpeza limitada; a tabela guarda somente contadores descartáveis.
  await database.execute(sql`DELETE FROM booking_rate_limits WHERE window_started_at < now() - interval '24 hours' AND (business_id, client_hash) IN
    (SELECT business_id, client_hash FROM booking_rate_limits WHERE window_started_at < now() - interval '24 hours' LIMIT 100)`);
  const result = await database.execute(sql`INSERT INTO booking_rate_limits (business_id, client_hash, attempts)
    VALUES (${businessId}, ${clientHash}, 1)
    ON CONFLICT (business_id, client_hash) DO UPDATE SET
      attempts = CASE WHEN booking_rate_limits.window_started_at <= now() - interval '1 minute' THEN 1 ELSE booking_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN booking_rate_limits.window_started_at <= now() - interval '1 minute' THEN now() ELSE booking_rate_limits.window_started_at END
    WHERE booking_rate_limits.attempts < 10 OR booking_rate_limits.window_started_at <= now() - interval '1 minute'
    RETURNING attempts`);
  if (!result.rows.length) throw new HttpError(429, "rate_limited", "Muitas tentativas. Aguarde um minuto e tente novamente.", 60);
}
