import { getDb } from "../../db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../env";
import { activateManualSubscription, listOpenSubscriptionRequests } from "./activate";

type Database = NodePgDatabase<typeof schema>;

type Env = Readonly<Record<string, string | undefined>>;

export function assertBillingScriptDatabase(env: Env = process.env) {
  if (!databaseEnvSchema.safeParse({ DATABASE_URL: env.DATABASE_URL }).success) {
    throw new Error("DATABASE_URL ausente ou inválida. Este script só roda com aprovação do dono, no banco que ele indicar. Não use o banco de produção por conta própria.");
  }
}

export type ActivateArgs = { business: string; months: number; by: string; dryRun: boolean };

function take(value: string | undefined, flag: string) {
  if (!value || value.startsWith("--")) throw new Error(`Informe o valor de ${flag}.`);
  return value;
}

function parseMonths(value: string) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("--months precisa ser um inteiro maior ou igual a 1.");
  const months = Number(value);
  if (!Number.isSafeInteger(months)) throw new Error("--months precisa ser um inteiro maior ou igual a 1.");
  return months;
}

export function parseActivateArgs(argv: readonly string[]): ActivateArgs {
  let business: string | undefined;
  let months = 1;
  let by: string | undefined;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--dry-run") { dryRun = true; continue; }
    const split = arg.startsWith("--") ? arg.indexOf("=") : -1;
    const flag = split === -1 ? arg : arg.slice(0, split);
    const inline = split === -1 ? undefined : arg.slice(split + 1);
    if (flag === "--business") { business = take(inline ?? argv[++index], flag); continue; }
    if (flag === "--by") { by = take(inline ?? argv[++index], flag); continue; }
    if (flag === "--months") { months = parseMonths(take(inline ?? argv[++index], flag)); continue; }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (!business?.trim()) throw new Error("Informe o negócio com --business <id|slug>.");
  const operator = by?.trim() ?? "";
  if (!operator) throw new Error("Informe o operador com --by <operador>.");
  if (operator.length > 120) throw new Error("O operador em --by pode ter no máximo 120 caracteres.");
  return { business: business.trim(), months, by: operator, dryRun };
}

export async function runActivateCli(argv: readonly string[], env: Env = process.env, database?: Database) {
  const args = parseActivateArgs(argv);
  assertBillingScriptDatabase(env);
  return activateManualSubscription(database ?? getDb(), args);
}

export async function runListRequestsCli(argv: readonly string[], env: Env = process.env, database?: Pick<Database, "select">) {
  if (argv.length > 0) throw new Error("billing:requests não recebe argumentos.");
  assertBillingScriptDatabase(env);
  return listOpenSubscriptionRequests(database ?? getDb());
}
