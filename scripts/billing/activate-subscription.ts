/**
 * Ativa a assinatura manual do AgendaPix.
 * Só roda com aprovação do dono. Não apontar DATABASE_URL para produção sem essa aprovação.
 *
 * pnpm billing:activate -- --business <id|slug> --by <operador> [--months 1] [--dry-run]
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import "dotenv/config";
import { runActivateCli } from "../../lib/billing/cli";

async function main() {
  const plan = await runActivateCli(process.argv.slice(2), process.env);
  if (plan.dryRun) process.stdout.write("dry-run: nada foi gravado\n");
}

const entry = process.argv[1];
const isDirect = entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (isDirect) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Não foi possível ativar a assinatura.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
