/**
 * Lista pedidos de assinatura ainda abertos.
 * Só roda com aprovação do dono. Não apontar DATABASE_URL para produção sem essa aprovação.
 *
 * pnpm billing:requests
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import "dotenv/config";
import { runListRequestsCli } from "../../lib/billing/cli";

async function main() {
  const rows = await runListRequestsCli(process.argv.slice(2), process.env);
  process.stdout.write(`${JSON.stringify(rows)}\n`);
}

const entry = process.argv[1];
const isDirect = entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (isDirect) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Não foi possível listar os pedidos.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
