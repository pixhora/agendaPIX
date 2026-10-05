// Migrador por arquivo: cada migration de db/migrations roda na própria transação, em ordem do journal.
//
// Por que não o migrador do Drizzle: ele envolve *todas* as migrations pendentes numa única transação, e o
// Postgres só deixa usar um valor novo de ENUM depois do COMMIT do `ALTER TYPE ... ADD VALUE` (0008 + 0009).
//
// Compatível com o journal do Drizzle (drizzle.__drizzle_migrations: hash sha256 do arquivo + created_at = `when`),
// então é no-op num banco já migrado por `drizzle-kit migrate` ou pelo migrador antigo.
//
// Uso: `pnpm db:migrate` (dev, lê .env) e `node migrate.cjs` na imagem Docker (este arquivo empacotado por
// `pnpm build:bundles`). MIGRATIONS_DIR troca a pasta (padrão: db/migrations relativo ao diretório atual).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import pg from "pg";
import { z } from "zod";

// Chave fixa do advisory lock: dois migradores simultâneos (ex.: deploy duplicado) rodam em série.
const MIGRATION_LOCK_KEY = 726_154_093;

async function main() {
  loadDotenv({ quiet: true });
  const url = z.url().parse(process.env.DATABASE_URL);
  const folder = resolve(process.env.MIGRATIONS_DIR ?? "db/migrations");
  const journal = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8"));
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
    const { rows } = await client.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations");
    const appliedHashes = new Set(rows.map((row) => row.hash));
    const appliedWhen = new Set(rows.map((row) => String(row.created_at)));
    let count = 0;
    for (const entry of journal.entries) {
      const file = `${entry.tag}.sql`;
      const path = join(folder, file);
      if (!existsSync(path)) throw new Error(`Migration ausente: ${file}`);
      const sql = readFileSync(path, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      if (appliedHashes.has(hash)) continue;
      if (appliedWhen.has(String(entry.when))) {
        // Mesmo critério do Drizzle (created_at): já aplicada, mas o arquivo mudou depois. Não reaplica.
        process.stderr.write(`aviso: ${file} já aplicada, mas o conteúdo mudou desde então; ignorando\n`);
        continue;
      }
      const statements = sql.split(/-->\s*statement-breakpoint\s*/).map((part) => part.trim()).filter(Boolean);
      // Uma transação por arquivo (Postgres 12+ aceita ADD VALUE dentro dela; o valor fica visível após o COMMIT).
      await client.query("BEGIN");
      try {
        for (const statement of statements) await client.query(statement);
        await client.query("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", [hash, entry.when]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
      count += 1;
      process.stdout.write(`aplicada ${file}\n`);
    }
    process.stdout.write(`Migrations em dia (${count} aplicada(s) agora, pasta ${folder}).\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Falha ao aplicar migrations: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
