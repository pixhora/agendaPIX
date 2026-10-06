/**
 * Processo de reconciliação de cobranças Pix.
 * Uso:
 *   pnpm reconcile --once          # uma passagem e sai
 *   pnpm reconcile                 # loop com RECONCILE_INTERVAL_SECONDS
 *   pnpm reconcile --once --json   # report em JSON
 *
 * Seguro sob concorrência: advisory lock de sessão; um trabalhador age, os demais saem.
 * Em produção: systemd/cron a cada minuto com --once, ou um serviço contínuo.
 */
import "dotenv/config";
import { getDb } from "../db/index";
import { paymentsConfig } from "../lib/payments/config";
import { getPaymentProvider } from "../lib/payments/index";
import { reconcileOnce } from "../lib/payments/reconcile";

const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const asJson = args.has("--json");

async function pass() {
  const database = getDb();
  let provider = null;
  try { provider = getPaymentProvider(process.env, database); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`reconcile: provedor indisponível (${message}); seguindo só com expiração local\n`);
  }
  const report = await reconcileOnce(database, provider, paymentsConfig());
  if (asJson) process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...report })}\n`);
  else {
    if (report.skippedLock) process.stdout.write("reconcile: outro processo segura o lock; saindo\n");
    else process.stdout.write(`reconcile: stuckRetried=${report.stuckRetried} stuckCancelled=${report.stuckCancelled} expiredCancelled=${report.expiredCancelled} polledPaid=${report.polledPaid} audits=${report.audits}\n`);
  }
  return report;
}

if (once) {
  await pass();
  await getDb().$client.end();
} else {
  const config = paymentsConfig();
  process.stdout.write(`reconcile: loop a cada ${config.RECONCILE_INTERVAL_SECONDS}s (Ctrl+C encerra)\n`);
  for (;;) {
    try { await pass(); }
    catch (error) { console.error("reconcile: falha na passagem", error instanceof Error ? error.message : error); }
    await new Promise((resolve) => setTimeout(resolve, config.RECONCILE_INTERVAL_SECONDS * 1000));
  }
}
