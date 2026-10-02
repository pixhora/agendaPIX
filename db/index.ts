import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseEnvSchema } from "../lib/env";
import * as schema from "./schema";

function createDatabase() {
  const env = databaseEnvSchema.parse(process.env);
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
  return drizzle(pool, { schema });
}

const globalDatabase = globalThis as typeof globalThis & { agendaDatabase?: ReturnType<typeof createDatabase> };

export function getDb() {
  return globalDatabase.agendaDatabase ??= createDatabase();
}
