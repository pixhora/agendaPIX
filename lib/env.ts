import { z } from "zod";

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
 * Segredos separados do de sessão. Vazios caem no `BETTER_AUTH_SECRET` para não invalidar
 * links e baldes já emitidos. Rotacionar um não mexe no outro.
 */
export const bookingSecretsSchema = z.object({
  BETTER_AUTH_SECRET: secretValue,
  BOOKING_ACCESS_SECRET: optionalSecret,
  RATE_LIMIT_SECRET: optionalSecret,
});

export function bookingAccessSecret(env: Readonly<Record<string, string | undefined>> = process.env) {
  const parsed = bookingSecretsSchema.safeParse(env);
  return parsed.success ? parsed.data.BOOKING_ACCESS_SECRET ?? parsed.data.BETTER_AUTH_SECRET : null;
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

export function assertProductionSafeEnv(env: Readonly<Record<string, string | undefined>> = process.env) {
  const parsed = productionRuntimeEnvSchema.safeParse({
    NODE_ENV: env.NODE_ENV,
    NEXT_PHASE: env.NEXT_PHASE,
    MAGIC_LINK_CAPTURE_FILE: env.MAGIC_LINK_CAPTURE_FILE,
    MP_CAPTURE: env.MP_CAPTURE,
    SMTP_FROM: env.SMTP_FROM,
  });
  if (parsed.success) return;
  const messages = [...new Set(parsed.error.issues.map((issue) => issue.message))];
  throw new Error(messages.join(" "));
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
