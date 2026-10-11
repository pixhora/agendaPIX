import { describe, expect, it } from "vitest";
import { authEnvSchema, databaseEnvSchema, smtpEnvSchema } from "../../lib/env";

describe("configuração do servidor", () => {
  it("exige URL de PostgreSQL", () => {
    expect(databaseEnvSchema.safeParse({ DATABASE_URL: "https://example.com" }).success).toBe(false);
    expect(databaseEnvSchema.safeParse({ DATABASE_URL: "postgresql://local:example@localhost/agenda" }).success).toBe(true);
  });
  it("rejeita segredo de exemplo e segredo curto", () => {
    for (const secret of ["curto", "replace-this-with-a-random-secret-at-least-32-characters"]) {
      expect(authEnvSchema.safeParse({ BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: secret }).success).toBe(false);
    }
  });
  it("converte false sem ativar TLS e exige credenciais em pares", () => {
    const smtp = { SMTP_HOST: "localhost", SMTP_PORT: "1025", SMTP_SECURE: "false", SMTP_FROM: "acesso@example.com" };
    expect(smtpEnvSchema.parse(smtp).SMTP_SECURE).toBe(false);
    expect(smtpEnvSchema.parse(smtp).SMTP_REPLY_TO).toBeUndefined();
    expect(smtpEnvSchema.parse({ ...smtp, SMTP_REPLY_TO: "  " }).SMTP_REPLY_TO).toBeUndefined();
    expect(smtpEnvSchema.parse({ ...smtp, SMTP_REPLY_TO: "AgendaPix <oi@agendapix.dev.br>" }).SMTP_REPLY_TO).toBe("AgendaPix <oi@agendapix.dev.br>");
    expect(smtpEnvSchema.safeParse({ ...smtp, SMTP_REPLY_TO: "linha\nquebrada" }).success).toBe(false);
    expect(smtpEnvSchema.safeParse({ ...smtp, SMTP_USER: "agenda" }).success).toBe(false);
  });
});
