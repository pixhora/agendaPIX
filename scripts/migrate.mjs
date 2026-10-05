// Aplica cada migration em sua própria conexão/transação.
// Necessário porque o migrador do Drizzle envolve *todas* as migrations numa única
// transação, e o Postgres só permite usar um valor novo de ENUM após o COMMIT do ADD VALUE.
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { z } from "zod";

const url = z.url().parse(process.env.DATABASE_URL);
const folder = join(process.cwd(), "db/migrations");
const journal = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8"));
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const applied = new Set((await client.query("SELECT hash FROM drizzle.__drizzle_migrations")).rows.map((row) => row.hash));
  for (const entry of journal.entries) {
    const file = `${entry.tag}.sql`;
    if (!readdirSync(folder).includes(file)) throw new Error(`Migration ausente: ${file}`);
    const sql = readFileSync(join(folder, file), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    if (applied.has(hash)) continue;
    const statements = sql.split(/-->\s*statement-breakpoint\s*/).map((part) => part.trim()).filter(Boolean);
    // ADD VALUE de ENUM não pode compartilhar transação com o uso do valor; rode sem BEGIN.
    const enumOnly = statements.every((statement) => /ALTER TYPE .* ADD VALUE/i.test(statement));
    if (!enumOnly) await client.query("BEGIN");
    try {
      for (const statement of statements) await client.query(statement);
      await client.query("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", [hash, entry.when]);
      if (!enumOnly) await client.query("COMMIT");
      process.stdout.write(`applied ${file}\n`);
    } catch (error) {
      if (!enumOnly) await client.query("ROLLBACK");
      throw error;
    }
  }
  process.stdout.write("migrations up to date\n");
} finally {
  await client.end();
}
