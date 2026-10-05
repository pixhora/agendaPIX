import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";

// Banco exclusivo: não aplicar migrations nem fixtures ao banco do aplicativo.
const name = `agenda_onboarding_${randomUUID().replaceAll("-", "")}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let created = false;
try {
  await pool.query(`CREATE DATABASE "${name}"`);
  created = true;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  const env = { ...process.env, DATABASE_URL: url.toString() };
  for (const args of [
    ["node_modules/drizzle-kit/bin.cjs", "migrate"],
    ["node_modules/drizzle-kit/bin.cjs", "migrate"],
    ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.db.config.ts", "tests/integration/onboarding.test.ts"],
  ]) {
    const result = spawnSync(process.execPath, args, { env, encoding: "utf8" });
    if (result.status !== 0) throw new Error("isolated_check_failed");
    process.stdout.write(args.includes("migrate") ? "MIGRATIONS_OK\n" : "ONBOARDING_INTEGRATION_OK\n");
  }
} catch {
  process.stderr.write("ONBOARDING_VERIFICATION_FAILED\n");
  process.exitCode = 1;
} finally {
  if (created) {
    await pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    process.stdout.write("ISOLATED_DB_REMOVED\n");
  }
  await pool.end();
}
