// Migrador por arquivo: cada migration de db/migrations roda na própria transação, em ordem do journal.
//
// Por que não o migrador do Drizzle: ele envolve *todas* as migrations pendentes numa única transação, e o
// Postgres só deixa usar um valor novo de ENUM depois do COMMIT do `ALTER TYPE ... ADD VALUE` (0008 + 0009).
//
// Compatível com o journal do Drizzle (drizzle.__drizzle_migrations: hash sha256 do arquivo + created_at = `when`),
// então é no-op num banco já migrado por `drizzle-kit migrate` ou pelo migrador antigo.
//
// URL, sem imprimir o valor:
//   1. DATABASE_URL já no ambiente (CI, Docker, `DATABASE_URL=... pnpm db:migrate`)
//   2. senão `.env.migrate` (gitignore; veja `.env.migrate.example`)
//   3. senão o `.env` que este script já carregava
//   4. senão, se o stdin for TTY, pergunta com entrada oculta
// Confirmação só com stdin TTY, salvo `--yes`. Sem TTY, segue se `--yes` ou se a URL veio do ambiente / `.env`.
// Sem isso, sai com erro em vez de esperar input.
//
// Uso: `pnpm db:migrate` e `node migrate.cjs` na imagem Docker (este arquivo empacotado por `pnpm build:bundles`).
// MIGRATIONS_DIR troca a pasta (padrão: db/migrations relativo ao diretório atual).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadDotenv, parse as parseDotenv } from "dotenv";
import pg from "pg";

const MIGRATION_LOCK_KEY = 726_154_093;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("DATABASE_URL inválida. Use uma URL PostgreSQL. Nada foi aplicado.");
  }
  if (!url || (url.protocol !== "postgres:" && url.protocol !== "postgresql:")) {
    fail("DATABASE_URL inválida. Use uma URL PostgreSQL. Nada foi aplicado.");
  }
  return value;
}

function redact(message, url) {
  let text = message;
  if (url) text = text.split(url).join("[DATABASE_URL]");
  try {
    const parsed = new URL(url);
    if (parsed.password) text = text.split(decodeURIComponent(parsed.password)).join("[redacted]");
    if (parsed.username) text = text.split(decodeURIComponent(parsed.username)).join("[redacted]");
  } catch {
    // A URL já foi rejeitada ou não está na mensagem.
  }
  return text;
}

function promptHidden(label) {
  return new Promise((resolve) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const cleanup = () => {
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      stdin.removeListener("data", onData);
    };
    const onData = (chunk) => {
      const text = String(chunk);
      if (text === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }
      if (text === "\r" || text === "\n") {
        process.stdout.write("\n");
        cleanup();
        resolve(value);
        return;
      }
      if (text === "\u007f" || text === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += text;
    };
    stdin.on("data", onData);
  });
}

function promptLine(label) {
  return new Promise((resolve) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const cleanup = () => {
      stdin.pause();
      stdin.removeListener("data", onData);
    };
    const onData = (chunk) => {
      const text = String(chunk);
      if (text === "\u0003") {
        cleanup();
        process.exit(130);
      }
      value += text;
      if (text.includes("\n")) {
        cleanup();
        resolve(value.trim());
      }
    };
    stdin.on("data", onData);
  });
}

function confirmed(answer) {
  const value = answer.trim().toLowerCase();
  return value === "s" || value === "sim" || value === "y" || value === "yes";
}

async function resolveDatabaseUrl(isTty) {
  const fromEnvironment = process.env.DATABASE_URL?.trim() ?? "";
  loadDotenv({ quiet: true });
  const fromDotenv = process.env.DATABASE_URL?.trim() ?? "";
  if (fromEnvironment) return { url: parseDatabaseUrl(fromEnvironment), source: "env" };
  if (existsSync(".env.migrate")) {
    const parsed = parseDotenv(readFileSync(".env.migrate"));
    const value = parsed.DATABASE_URL?.trim() ?? "";
    if (!value) fail(".env.migrate existe, mas não define DATABASE_URL. Nada foi aplicado.");
    return { url: parseDatabaseUrl(value), source: "file" };
  }
  if (fromDotenv) return { url: parseDatabaseUrl(fromDotenv), source: "dotenv" };
  if (isTty) {
    const value = (await promptHidden("DATABASE_URL (a digitação não aparece): ")).trim();
    if (!value) fail("DATABASE_URL vazia. Nada foi aplicado.");
    return { url: parseDatabaseUrl(value), source: "prompt" };
  }
  fail("Sem DATABASE_URL, sem .env.migrate e sem terminal interativo. Defina DATABASE_URL ou crie .env.migrate. Nada foi aplicado.");
}

function existingEnvPath(source) {
  return source === "env" || source === "dotenv";
}

let databaseUrl = "";

async function main() {
  const yes = process.argv.includes("--yes");
  const isTty = Boolean(process.stdin.isTTY);
  const resolved = await resolveDatabaseUrl(isTty);
  const { url, source } = resolved;
  databaseUrl = url;
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
    const pending = [];
    for (const entry of journal.entries) {
      const file = `${entry.tag}.sql`;
      const path = join(folder, file);
      if (!existsSync(path)) throw new Error(`Migration ausente: ${file}`);
      const sql = readFileSync(path, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      if (appliedHashes.has(hash)) continue;
      if (appliedWhen.has(String(entry.when))) {
        process.stderr.write(`aviso: ${file} já aplicada, mas o conteúdo mudou desde então; ignorando\n`);
        continue;
      }
      const statements = sql.split(/-->\s*statement-breakpoint\s*/).map((part) => part.trim()).filter(Boolean);
      pending.push({ file, hash, when: entry.when, statements });
    }
    if (pending.length === 0) {
      process.stdout.write(`Migrations em dia (0 aplicada(s) agora, pasta ${folder}).\n`);
      return;
    }
    process.stdout.write("Migrations pendentes:\n");
    for (const item of pending) process.stdout.write(`- ${item.file}\n`);
    if (isTty && !yes) {
      const answer = await promptLine("Aplicar estas migrations? [s/N] ");
      if (!confirmed(answer)) {
        process.stdout.write("Migrations não aplicadas.\n");
        return;
      }
    } else if (!isTty && !yes && !existingEnvPath(source)) {
      throw new Error("Sem terminal interativo. Passe --yes para aplicar, ou defina DATABASE_URL no ambiente. Nada foi aplicado.");
    }
    let count = 0;
    for (const item of pending) {
      await client.query("BEGIN");
      try {
        for (const statement of item.statements) await client.query(statement);
        await client.query("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", [item.hash, item.when]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${item.file}: ${error instanceof Error ? error.message : String(error)}`);
      }
      count += 1;
      process.stdout.write(`aplicada ${item.file}\n`);
    }
    process.stdout.write(`Migrations em dia (${count} aplicada(s) agora, pasta ${folder}).\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Falha ao aplicar migrations: ${redact(message, databaseUrl)}\n`);
  process.exit(1);
});
