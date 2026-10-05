/**
 * Aplica as migrations versionadas em db/migrations usando o migrator do drizzle-orm.
 * Usa a mesma tabela de controle do `drizzle-kit migrate` (drizzle.__drizzle_migrations),
 * então `pnpm db:migrate` (dev) e `node migrate.cjs` (imagem de produção) são intercambiáveis.
 *
 * Na imagem Docker este arquivo é empacotado com esbuild em migrate.cjs (ver `pnpm build:migrate`)
 * porque o output standalone do Next não inclui drizzle-kit.
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { databaseEnvSchema } from "../lib/env";

async function main() {
  const env = databaseEnvSchema.parse(process.env);
  const migrationsFolder = path.resolve(process.env.MIGRATIONS_DIR ?? "db/migrations");
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    process.stdout.write(`Migrations aplicadas a partir de ${migrationsFolder}.\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha ao aplicar migrations: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
