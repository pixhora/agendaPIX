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
