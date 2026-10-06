import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http";
import { authorizeCron, reconcileDatabaseUrl } from "../../lib/payments/cron";

const secret = "s".repeat(40);

function status(run: () => unknown) {
  try { run(); return 200; }
  catch (error) { return error instanceof HttpError ? error.status : 500; }
}

describe("rota de cron do reconciliador", () => {
  it("fica indisponível sem CRON_SECRET válido", () => {
    expect(status(() => authorizeCron(`Bearer ${secret}`, {}))).toBe(503);
    expect(status(() => authorizeCron("Bearer curto", { CRON_SECRET: "curto" }))).toBe(503);
    expect(status(() => authorizeCron("Bearer x", { CRON_SECRET: `replace-this-${secret}` }))).toBe(503);
  });
  it("exige o bearer exato", () => {
    expect(status(() => authorizeCron(null, { CRON_SECRET: secret }))).toBe(401);
    expect(status(() => authorizeCron(`Bearer ${secret}x`, { CRON_SECRET: secret }))).toBe(401);
    expect(status(() => authorizeCron(secret, { CRON_SECRET: secret }))).toBe(401);
    expect(status(() => authorizeCron(`Bearer ${secret}`, { CRON_SECRET: secret }))).toBe(200);
  });
  it("prefere a conexão direta (sem pooler) para o advisory lock de sessão", () => {
    const pooled = "postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech/db?sslmode=require";
    const direct = "postgresql://u:p@ep-x.sa-east-1.aws.neon.tech/db?sslmode=require";
    expect(reconcileDatabaseUrl({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct })).toBe(direct);
    expect(reconcileDatabaseUrl({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: "" })).toBe(pooled);
    expect(status(() => reconcileDatabaseUrl({}))).toBe(503);
  });
});
