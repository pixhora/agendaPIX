import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseEnvSchema } from "../lib/env";
import * as schema from "./schema";

function createDatabase() {
  const env = databaseEnvSchema.parse(process.env);
  // Pool do node-postgres na frente do pooler do Neon (host "-pooler" em DATABASE_URL). Não é o driver HTTP do Neon.
  // Na Vercel (Fluid compute) cada instância mantém poucas conexões, recicla as velhas e fecha as ociosas antes de suspender.
  const serverless = Boolean(process.env.VERCEL);
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: serverless ? 5 : 10,
    connectionTimeoutMillis: 5000,
    ...(serverless ? { idleTimeoutMillis: 5000, maxLifetimeSeconds: 60, allowExitOnIdle: true } : {}),
  });
  if (serverless) attachDatabasePool(pool);
  return drizzle(pool, { schema });
}

const globalDatabase = globalThis as typeof globalThis & { agendaDatabase?: ReturnType<typeof createDatabase> };

export function getDb() {
  return globalDatabase.agendaDatabase ??= createDatabase();
}
