import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseEnvSchema } from "../lib/env";
import * as schema from "./schema";

function createDatabase() {
  const env = databaseEnvSchema.parse(process.env);
  // Na Vercel (Fluid compute) cada instância mantém poucas conexões e fecha as ociosas antes de suspender.
  // Use a URL com pooler do Neon (host "-pooler") em DATABASE_URL.
  const serverless = Boolean(process.env.VERCEL);
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: serverless ? 5 : 10,
    connectionTimeoutMillis: 5000,
    ...(serverless ? { idleTimeoutMillis: 5000 } : {}),
  });
  if (serverless) attachDatabasePool(pool);
  return drizzle(pool, { schema });
}

const globalDatabase = globalThis as typeof globalThis & { agendaDatabase?: ReturnType<typeof createDatabase> };

export function getDb() {
  return globalDatabase.agendaDatabase ??= createDatabase();
}
