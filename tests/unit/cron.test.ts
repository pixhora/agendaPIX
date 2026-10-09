import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http";
import { authorizeCron, reconcileDatabaseUrl, runCronTick } from "../../lib/payments/cron";
import type { ReconcileReport } from "../../lib/payments/reconcile";

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

const quietReport = (): ReconcileReport => ({
  stuckRetried: 0, stuckCancelled: 0, expiredCancelled: 0, polledPaid: 0, refundsSettled: 0, audits: 0, skippedLock: false,
  failures: 0, deferred: 0, stagesSkipped: 0,
});

describe("limpeza de rascunhos na rota de cron", () => {
  it("segue para a reconciliação quando a limpeza falha, sem devolver dado pessoal", async () => {
    const reconcile = vi.fn(async () => quietReport());
    const seen: string[] = [];
    const result = await runCronTick({
      deleteExpiredDrafts: async () => { throw new Error("rascunho dono@salao.com token Bearer abc"); },
      reconcile,
      now: new Date("2026-10-09T06:00:00.000Z"),
      onDraftCleanupError: (code) => { seen.push(code); },
    });
    expect(reconcile).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ at: "2026-10-09T06:00:00.000Z", expiredDraftsDeleted: 0, draftCleanupFailed: true, polledPaid: 0 });
    expect(seen).toEqual(["reconcile_failed"]);
    expect(JSON.stringify(result)).not.toContain("dono@salao.com");
    expect(seen.join(" ")).not.toContain("Bearer");
  });
});
