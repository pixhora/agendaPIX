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
