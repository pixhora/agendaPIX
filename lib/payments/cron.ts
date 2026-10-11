import { createHash, timingSafeEqual } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import * as schema from "../../db/schema";
import { HttpError } from "../http";
import { explicitSslMode } from "../db-url";
import { paymentsConfig } from "./config";
import { getPaymentProvider } from "./index";
import { reconcileFailureCode, reconcileOnce, type ReconcileReport } from "./reconcile";

const cronSecret = z.string().min(32).refine((value) => !value.startsWith("replace-this-"));
const postgresUrl = z.url().refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol));

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Autoriza o disparo do reconciliador sem servidor (Vercel Cron ou agendador externo).
 * A Vercel envia `Authorization: Bearer <CRON_SECRET>`; sem CRON_SECRET válido a rota fica indisponível (503).
 */
export function authorizeCron(authorization: string | null, env: Readonly<Record<string, string | undefined>> = process.env) {
  const secret = cronSecret.safeParse(env.CRON_SECRET);
  if (!secret.success) throw new HttpError(503, "cron_unavailable", "Reconciliação indisponível.");
  const token = /^Bearer (\S+)$/.exec(authorization ?? "")?.[1] ?? "";
  if (!timingSafeEqual(digest(token), digest(secret.data))) throw new HttpError(401, "unauthorized", "Não autorizado.");
}

/**
 * URL da passagem de reconciliação. O reconciliador segura advisory lock de SESSÃO, que não funciona atrás de
 * pooler em modo transação (PgBouncer/Neon "-pooler"): por isso prefere a conexão direta DATABASE_URL_UNPOOLED
 * (criada pela integração Neon ↔ Vercel) e só cai para DATABASE_URL quando ela não existe.
 */
export function reconcileDatabaseUrl(env: Readonly<Record<string, string | undefined>> = process.env) {
  const candidate = env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL;
  const parsed = postgresUrl.safeParse(candidate);
  if (!parsed.success) throw new HttpError(503, "cron_unavailable", "Reconciliação indisponível.");
  return parsed.data;
}

/**
 * Limpeza de rascunhos e reconciliação na mesma rota. Falha ao apagar rascunhos
 * não impede a passagem de pagamento: o relatório marca `draftCleanupFailed` e segue.
 */
export async function runCronTick(input: {
  deleteExpiredDrafts: () => Promise<number>;
  reconcile: () => Promise<ReconcileReport>;
  purgeSlotLinkLabels?: () => Promise<number>;
  now?: Date;
  onDraftCleanupError?: (code: string) => void;
  onSlotLinkLabelError?: (code: string) => void;
}) {
  let expiredDraftsDeleted = 0;
  let draftCleanupFailed = false;
  try {
    expiredDraftsDeleted = await input.deleteExpiredDrafts();
  } catch (error) {
    draftCleanupFailed = true;
    input.onDraftCleanupError?.(reconcileFailureCode(error));
  }
  let slotLinkLabelsPurged = 0;
  let slotLinkLabelPurgeFailed = false;
  if (input.purgeSlotLinkLabels) {
    try {
      slotLinkLabelsPurged = await input.purgeSlotLinkLabels();
    } catch (error) {
      slotLinkLabelPurgeFailed = true;
      input.onSlotLinkLabelError?.(reconcileFailureCode(error));
    }
  }
  const report = await input.reconcile();
  return {
    at: (input.now ?? new Date()).toISOString(),
    expiredDraftsDeleted,
    draftCleanupFailed,
    slotLinkLabelsPurged,
    slotLinkLabelPurgeFailed,
    ...report,
  };
}

/** Uma passagem com pool dedicado de uma conexão, encerrado ao final (nada fica aberto entre execuções). */
export async function runReconcilePass() {
  const config = paymentsConfig();
  let provider = null;
  try { provider = getPaymentProvider(); }
  catch { provider = null; } // sem gateway: só expira holds locais (mesmo comportamento do script)
  const pool = new Pool({ connectionString: explicitSslMode(reconcileDatabaseUrl()), max: 1, connectionTimeoutMillis: 10000 });
  try {
    const database = Object.assign(drizzle(pool, { schema }), { $client: pool });
    return await reconcileOnce(database, provider, config);
  } finally {
    await pool.end();
  }
}
