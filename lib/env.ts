import { z } from "zod";
import { bookingConfig } from "./bookings/config";

const postgresUrl = z.url().refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), "Use uma URL PostgreSQL.");

export const databaseEnvSchema = z.object({ DATABASE_URL: postgresUrl });
const secretValue = z.string().min(32).refine((value) => !value.startsWith("replace-this-"), "Substitua o segredo de exemplo.");
const optionalSecret = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  secretValue.optional(),
);

export const authEnvSchema = z.object({
  BETTER_AUTH_URL: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Use uma URL HTTP ou HTTPS."),
  BETTER_AUTH_SECRET: secretValue,
});

/**
 * Segredos separados do de sessão. Fora de produção, vazio cai no `BETTER_AUTH_SECRET`
 * para não invalidar links e baldes já emitidos. Em produção o de acesso é obrigatório
 * e não acompanha o de sessão. Rotacionar um não mexe no outro.
 * `BOOKING_ACCESS_SECRET_PREVIOUS` só entra na verificação, nunca na assinatura nova.
 */
export const bookingSecretsSchema = z.object({
  BETTER_AUTH_SECRET: secretValue,
  BOOKING_ACCESS_SECRET: optionalSecret,
  RATE_LIMIT_SECRET: optionalSecret,
});

const bookingAccessSecretProductionMessage = {
  empty: "BOOKING_ACCESS_SECRET é obrigatório em produção e no preview.",
  short: "BOOKING_ACCESS_SECRET precisa ter pelo menos 32 caracteres.",
  same: "BOOKING_ACCESS_SECRET não pode ser igual a BETTER_AUTH_SECRET.",
  placeholder: "BOOKING_ACCESS_SECRET ainda é o valor de exemplo. Troque o segredo.",
} as const;

function normalizedSecret(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  return value.length === 0 ? undefined : value;
}

/** Boot (`NODE_ENV=production`, fora do `next build`) ou build da Vercel de produção e de preview. */
export function requiresDedicatedBookingAccessSecret(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") return true;
  return env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
}

/**
 * Segredo atual dos links de reserva. Em produção e no preview da Vercel não cai em
 * `BETTER_AUTH_SECRET`: vazio, curto, prefixo de exemplo ou igual ao segredo de sessão
 * devolve null. Fora disso, vazio ainda cai.
 */
export function bookingAccessSecret(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (requiresDedicatedBookingAccessSecret(env)) {
    const value = normalizedSecret(env.BOOKING_ACCESS_SECRET);
    const auth = normalizedSecret(env.BETTER_AUTH_SECRET);
    if (!value || value.length < 32 || value.startsWith("replace-this-")) return null;
    if (auth && value === auth) return null;
    return value;
  }
  const parsed = bookingSecretsSchema.safeParse(env);
  return parsed.success ? parsed.data.BOOKING_ACCESS_SECRET ?? parsed.data.BETTER_AUTH_SECRET : null;
}

/**
 * Segredo anterior, só para achar o HMAC de um Pix de link de horário já começado.
 * Vazio ou com menos de 32 caracteres conta como ausente.
 * Não herda `BETTER_AUTH_SECRET`: quem rotaciona grava o valor antigo aqui.
 * Pode ser igual a `BETTER_AUTH_SECRET`. Essa igualdade não derruba o boot.
 * Igual ao segredo atual também não derruba: o boot só avisa, sem o valor.
 */
export function bookingAccessSecretPrevious(env: Readonly<Record<string, string | undefined>> = process.env) {
  const value = normalizedSecret(env.BOOKING_ACCESS_SECRET_PREVIOUS);
  if (!value || value.length < 32) return null;
  return value;
}

/** Boot e `next build` de produção e de preview. A mensagem cita o nome e o motivo, nunca o valor. Não olha `BOOKING_ACCESS_SECRET_PREVIOUS`. */
export function assertBookingAccessSecret(env: Readonly<Record<string, string | undefined>> = process.env) {
  const value = normalizedSecret(env.BOOKING_ACCESS_SECRET);
  if (!value) throw new Error(bookingAccessSecretProductionMessage.empty);
  if (value.startsWith("replace-this-")) throw new Error(bookingAccessSecretProductionMessage.placeholder);
  if (value.length < 32) throw new Error(bookingAccessSecretProductionMessage.short);
  const auth = normalizedSecret(env.BETTER_AUTH_SECRET);
  if (auth && value === auth) throw new Error(bookingAccessSecretProductionMessage.same);
}

let warnedBookingAccessSecretPrevious = false;

/** Um aviso por processo, sem o valor, enquanto a rotação ainda aceita o segredo anterior. */
export function warnBookingAccessSecretPrevious(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (warnedBookingAccessSecretPrevious) return;
  const raw = normalizedSecret(env.BOOKING_ACCESS_SECRET_PREVIOUS);
  if (!raw) return;
  warnedBookingAccessSecretPrevious = true;
  if (raw.length < 32) {
    console.warn("BOOKING_ACCESS_SECRET_PREVIOUS precisa ter pelo menos 32 caracteres.");
    return;
  }
  console.warn("BOOKING_ACCESS_SECRET_PREVIOUS está definido. Ele só vale para Pix de link de horário já começado antes da rotação. Remova depois que esses pagamentos passarem.");
  const current = normalizedSecret(env.BOOKING_ACCESS_SECRET);
  if (current && raw === current) {
    console.warn("BOOKING_ACCESS_SECRET_PREVIOUS é igual a BOOKING_ACCESS_SECRET.");
  }
}

/** Só para teste. O processo real avisa uma vez. */
export function resetBookingAccessSecretPreviousWarning() {
  warnedBookingAccessSecretPrevious = false;
}

export function rateLimitSecret(env: Readonly<Record<string, string | undefined>> = process.env) {
  const parsed = bookingSecretsSchema.safeParse(env);
  return parsed.success ? parsed.data.RATE_LIMIT_SECRET ?? parsed.data.BETTER_AUTH_SECRET : null;
}
export const smtpEnvSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
  SMTP_FROM: z.string().min(1).refine((value) => !/[\r\n]/.test(value), "Remetente inválido."),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
}).refine((value) => Boolean(value.SMTP_USER) === Boolean(value.SMTP_PASSWORD), "Configure usuário e senha SMTP juntos.");

/** Domínio de exemplo (e subdomínios). Não inclui o endereço na mensagem de erro. */
export function smtpFromUsesExampleDomain(from: string): boolean {
  const wrapped = from.match(/<([^>]+)>/);
  const address = (wrapped?.[1] ?? from).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 0) return false;
  const domain = address.slice(at + 1).replace(/\.+$/, "");
  return domain === "example.com" || domain.endsWith(".example.com");
}

const productionBootMessage = {
  capture: "MAGIC_LINK_CAPTURE_FILE não pode estar definido em produção.",
  fixtures: "MP_CAPTURE não pode estar definido em produção.",
  from: "SMTP_FROM não pode usar o domínio example.com em produção.",
} as const;

/**
 * Boot de produção. O `next build` (NEXT_PHASE=phase-production-build) não é boot:
 * o .env local de desenvolvimento pode ter remetente de exemplo.
 * A mensagem não repete caminho, flag nem endereço.
 */
export const productionRuntimeEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  NEXT_PHASE: z.string().optional(),
  MAGIC_LINK_CAPTURE_FILE: z.string().optional(),
  MP_CAPTURE: z.string().optional(),
  SMTP_FROM: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production" || value.NEXT_PHASE === "phase-production-build") return;
  if (value.MAGIC_LINK_CAPTURE_FILE?.trim()) ctx.addIssue({ code: "custom", message: productionBootMessage.capture });
  if (value.MP_CAPTURE?.trim()) ctx.addIssue({ code: "custom", message: productionBootMessage.fixtures });
  if (value.SMTP_FROM?.trim() && smtpFromUsesExampleDomain(value.SMTP_FROM)) ctx.addIssue({ code: "custom", message: productionBootMessage.from });
});

const productionPkceMessage = "MP_OAUTH_PKCE deve ser on quando MERCADOPAGO_ENV=production.";

/** " on " e "on" são o mesmo valor. O boot e `assertMpOAuthPkce` leem por aqui. */
export function readMpOAuthPkce(raw: string | undefined): "on" | "off" | "missing" | "invalid" {
  if (raw === undefined) return "missing";
  const value = raw.trim();
  if (value === "on") return "on";
  if (value === "off") return "off";
  return "invalid";
}

function productionBoot(env: Readonly<Record<string, string | undefined>>) {
  return env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
}

const vercelProductionPkceMessage = "MP_OAUTH_PKCE deve ser on quando VERCEL_ENV=production.";

/**
 * O `register()` do instrumentation só roda quando a instância sobe. Na Vercel isso é
 * depois do deploy, e um throw vira 500 em toda rota, inclusive `/api/health`.
 * `next.config.ts` chama isto ao carregar. `VERCEL_ENV=production` exige `MP_OAUTH_PKCE=on`,
 * `bookingConfig` e `BOOKING_ACCESS_SECRET`. `VERCEL_ENV=preview` exige o mesmo
 * `BOOKING_ACCESS_SECRET`, para o preview não cair em `BETTER_AUTH_SECRET`.
 * PKCE e `bookingConfig` continuam só no build de produção. Dev não entra.
 * ` on ` vale `on`. A mensagem não repete o valor.
 */
export function assertVercelProductionBuild(env: Readonly<Record<string, string | undefined>> = process.env) {
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv !== "production" && vercelEnv !== "preview") return;
  if (vercelEnv === "production") {
    if (readMpOAuthPkce(env.MP_OAUTH_PKCE) !== "on") throw new Error(vercelProductionPkceMessage);
    bookingConfig(env);
  }
  assertBookingAccessSecret(env);
}

/**
 * Boot de produção. Chamado por `instrumentation.ts` e pelo worker de reconciliação.
 * Não cria um segundo caminho: PKCE em produção e `bookingConfig` passam por aqui.
 * `bookingConfig` só roda com `NODE_ENV=production`. O `next build` não é boot:
 * a recusa do deploy de produção fica em `assertVercelProductionBuild`.
 * A mensagem de PKCE não repete o valor configurado.
 */
export function assertProductionSafeEnv(env: Readonly<Record<string, string | undefined>> = process.env) {
  const parsed = productionRuntimeEnvSchema.safeParse({
    NODE_ENV: env.NODE_ENV,
    NEXT_PHASE: env.NEXT_PHASE,
    MAGIC_LINK_CAPTURE_FILE: env.MAGIC_LINK_CAPTURE_FILE,
    MP_CAPTURE: env.MP_CAPTURE,
    SMTP_FROM: env.SMTP_FROM,
  });
  if (!parsed.success) {
    const messages = [...new Set(parsed.error.issues.map((issue) => issue.message))];
    throw new Error(messages.join(" "));
  }
  if (!productionBoot(env)) return;
  if (env.MERCADOPAGO_ENV === "production" && readMpOAuthPkce(env.MP_OAUTH_PKCE) !== "on") {
    throw new Error(productionPkceMessage);
  }
  bookingConfig(env);
  assertBookingAccessSecret(env);
  warnBookingAccessSecretPrevious(env);
}

const staticRedirectUri = z.url().refine((value) => {
  const url = new URL(value);
  const https = url.protocol === "https:";
  const local = url.protocol === "http:" && url.hostname === "localhost";
  return (https || local) && url.search === "" && url.hash === "";
}, "MP_OAUTH_REDIRECT_URI deve ser uma URL estática https (ou http://localhost), sem query nem fragmento.");

/** Credenciais da aplicação Mercado Pago e a chave que cifra os tokens OAuth do vendedor. */
export const mercadoPagoOAuthEnvSchema = z.object({
  MP_CLIENT_ID: z.string().trim().min(1).max(64),
  MP_CLIENT_SECRET: z.string().trim().min(1),
  MP_OAUTH_REDIRECT_URI: staticRedirectUri,
  MP_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, "Configure MP_TOKEN_ENCRYPTION_KEY como 64 caracteres hexadecimais."),
  // Padrão no código: https://auth.mercadopago.com/authorization. Este campo só sobrescreve.
  MP_OAUTH_AUTHORIZE_URL: z.url().optional(),
});
