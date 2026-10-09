import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { abuseRateLimits } from "../db/schema";
import { getDb } from "../db";
import { bookingClientIdentity } from "./bookings/rate-limit";
import { authEnvSchema } from "./env";
import { HttpError } from "./http";

type WindowName = "minute" | "hour";

const WINDOW_MS: Record<WindowName, number> = { minute: 60_000, hour: 3_600_000 };

function windowInterval(window: WindowName) {
  return window === "hour" ? sql`interval '1 hour'` : sql`interval '1 minute'`;
}

function clientHash(scope: string, identity: string) {
  const env = authEnvSchema.safeParse(process.env);
  if (!env.success) throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
  return createHmac("sha256", env.data.BETTER_AUTH_SECRET).update(`${scope}:${identity}`).digest("hex");
}

/**
 * Contador atômico por escopo. A identidade (IP ou e-mail) só entra no HMAC;
 * a tabela guarda o hash. Janela vencida recomeça do 1.
 */
export async function consumeAbuseBucket(
  scope: string,
  identity: string,
  limit: number,
  window: WindowName,
  database: ReturnType<typeof getDb> = getDb(),
) {
  const hash = clientHash(scope, identity);
  const interval = windowInterval(window);
  await database.execute(sql`DELETE FROM abuse_rate_limits WHERE window_started_at < now() - interval '24 hours' AND (scope, client_hash) IN
    (SELECT scope, client_hash FROM abuse_rate_limits WHERE window_started_at < now() - interval '24 hours' LIMIT 100)`);
  const inserted = await database.execute(sql`INSERT INTO abuse_rate_limits (scope, client_hash, attempts)
    VALUES (${scope}, ${hash}, 1)
    ON CONFLICT (scope, client_hash) DO UPDATE SET
      attempts = CASE WHEN abuse_rate_limits.window_started_at <= now() - ${interval} THEN 1 ELSE abuse_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN abuse_rate_limits.window_started_at <= now() - ${interval} THEN now() ELSE abuse_rate_limits.window_started_at END
    WHERE abuse_rate_limits.attempts < ${limit} OR abuse_rate_limits.window_started_at <= now() - ${interval}
    RETURNING attempts`);
  if (inserted.rows.length > 0) return;
  const [row] = await database.select().from(abuseRateLimits).where(and(eq(abuseRateLimits.scope, scope), eq(abuseRateLimits.clientHash, hash))).limit(1);
  const elapsed = row ? Date.now() - row.windowStartedAt.getTime() : 0;
  const retryAfter = Math.max(1, Math.ceil((WINDOW_MS[window] - elapsed) / 1000));
  throw new HttpError(429, "rate_limited", "Muitas tentativas. Espere um pouco e tente de novo.", retryAfter, { retryAfter });
}

/** 10 rascunhos por IP por hora. Sem IP confiável, não há balde compartilhado. */
export async function consumeDraftCreateLimit(request: Request, database?: ReturnType<typeof getDb>) {
  const identity = bookingClientIdentity(request);
  if (!identity) return;
  await consumeAbuseBucket("onboarding-draft", identity, 10, "hour", database);
}

/** 30 consultas de link por IP por minuto. */
export async function consumeSlugAvailabilityLimit(request: Request, database?: ReturnType<typeof getDb>) {
  const identity = bookingClientIdentity(request);
  if (!identity) return;
  await consumeAbuseBucket("slug-availability", identity, 30, "minute", database);
}

/**
 * 5 envios de código por e-mail por hora e 20 por IP por hora.
 * O plugin emailOTP 1.7.7 só tem um `rateLimit` para todos os caminhos
 * (envio e conferência). O teto por e-mail fica nesta tabela.
 */
export async function consumeEmailOtpSendQuota(email: string, request?: Request, database?: ReturnType<typeof getDb>) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await consumeAbuseBucket("email-otp-email", `email:${normalized}`, 5, "hour", database);
  const identity = request ? bookingClientIdentity(request) : null;
  if (identity) await consumeAbuseBucket("email-otp-ip", identity, 20, "hour", database);
}
