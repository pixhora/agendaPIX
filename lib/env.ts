import { z } from "zod";

const postgresUrl = z.url().refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), "Use uma URL PostgreSQL.");

export const databaseEnvSchema = z.object({ DATABASE_URL: postgresUrl });
export const authEnvSchema = z.object({
  BETTER_AUTH_URL: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Use uma URL HTTP ou HTTPS."),
  BETTER_AUTH_SECRET: z.string().min(32).refine((value) => !value.startsWith("replace-this-"), "Substitua o segredo de exemplo."),
});
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

/** Credenciais da aplicação marketplace e a chave que cifra os tokens OAuth do vendedor. */
export const mercadoPagoOAuthEnvSchema = z.object({
  MP_CLIENT_ID: z.string().trim().min(1).max(64),
  MP_CLIENT_SECRET: z.string().trim().min(1),
  MP_OAUTH_REDIRECT_URI: staticRedirectUri,
  MP_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, "Configure MP_TOKEN_ENCRYPTION_KEY como 64 caracteres hexadecimais."),
  // A doc de OAuth mostra auth.mercadopago.com; o guia de Split mostra auth.mercadopago.com.br. O padrão é .com.br.
  MP_OAUTH_AUTHORIZE_URL: z.url().optional(),
});
