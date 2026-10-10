import { and, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { mercadopagoConnections, mercadopagoOauthStates, mpConnectionEvents, payments } from "../../db/schema";
import { MP_DISCONNECT_STUCK_PIX_MS, type DisconnectTokenHold, type MpConnection, type MpConnectionStore } from "./types";

type Database = Pick<ReturnType<typeof getDb>, "select" | "insert" | "update" | "delete" | "transaction" | "execute">;
type Row = typeof mercadopagoConnections.$inferSelect;

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function postgresCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if (error instanceof Error && error.cause) return postgresCode(error.cause);
  return undefined;
}

function fromRow(row: Row): MpConnection {
  return {
    businessId: row.businessId,
    mpUserId: row.mpUserId,
    accessTokenEnc: row.accessTokenEnc,
    refreshTokenEnc: row.refreshTokenEnc,
    publicKey: row.publicKey,
    scope: row.scope,
    liveMode: row.liveMode,
    expiresAt: row.expiresAt,
    connectedAt: row.connectedAt,
    refreshedAt: row.refreshedAt,
    status: row.status,
    lastError: row.lastError,
    disconnectedAt: row.disconnectedAt,
    consentVersion: row.consentVersion,
    consentTextSha256: row.consentTextSha256,
    autoRefundAckAt: row.autoRefundAckAt,
    consentUserId: row.consentUserId,
    accountDisplayName: row.accountDisplayName,
    accountEmailMasked: row.accountEmailMasked,
  };
}

function toValues(connection: MpConnection) {
  return {
    businessId: connection.businessId,
    mpUserId: connection.mpUserId,
    accessTokenEnc: connection.accessTokenEnc,
    refreshTokenEnc: connection.refreshTokenEnc,
    publicKey: connection.publicKey,
    scope: connection.scope,
    liveMode: connection.liveMode,
    expiresAt: connection.expiresAt,
    connectedAt: connection.connectedAt,
    refreshedAt: connection.refreshedAt,
    status: connection.status,
    lastError: connection.lastError,
    disconnectedAt: connection.disconnectedAt,
    consentVersion: connection.consentVersion,
    consentTextSha256: connection.consentTextSha256,
    autoRefundAckAt: connection.autoRefundAckAt,
    consentUserId: connection.consentUserId,
    accountDisplayName: connection.accountDisplayName,
    accountEmailMasked: connection.accountEmailMasked,
    updatedAt: new Date(),
  };
}

/** Colunas que o webhook de desconexão grava. O mesmo objeto entra na transação do dedupe. */
export function deauthorizedConnectionPatch(now = new Date()) {
  return {
    status: "needs_reconnect" as const,
    accessTokenEnc: null,
    refreshTokenEnc: null,
    lastError: "application.deauthorized",
    disconnectedAt: null,
    updatedAt: now,
  };
}

export async function markMpUserDeauthorized(database: Pick<Database, "update">, mpUserId: string) {
  const rows = await database.update(mercadopagoConnections).set(deauthorizedConnectionPatch()).where(eq(mercadopagoConnections.mpUserId, mpUserId)).returning({ businessId: mercadopagoConnections.businessId });
  return rows.map((row) => row.businessId);
}

export function createDrizzleMpStore(database: Database = getDb()): MpConnectionStore {
  return {
    async findByBusinessId(businessId) {
      const [row] = await database.select().from(mercadopagoConnections).where(eq(mercadopagoConnections.businessId, businessId)).limit(1);
      return row ? fromRow(row) : null;
    },
    async findConnectedBusinessId(mpUserId) {
      const [row] = await database.select({ businessId: mercadopagoConnections.businessId }).from(mercadopagoConnections).where(and(
        eq(mercadopagoConnections.mpUserId, mpUserId),
        eq(mercadopagoConnections.status, "connected"),
      )).limit(1);
      return row?.businessId ?? null;
    },
    async findByMpUserId(mpUserId) {
      const rows = (await database.select().from(mercadopagoConnections).where(eq(mercadopagoConnections.mpUserId, mpUserId))).map(fromRow);
      return rows.find((row) => row.status === "connected" && row.accessTokenEnc) ?? rows.find((row) => row.accessTokenEnc) ?? null;
    },
    async saveConnected(connection) {
      try {
        return await database.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(74822, hashtext(${connection.mpUserId}))`);
          const [other] = await tx.select({ businessId: mercadopagoConnections.businessId }).from(mercadopagoConnections).where(and(
            eq(mercadopagoConnections.mpUserId, connection.mpUserId),
            eq(mercadopagoConnections.status, "connected"),
            ne(mercadopagoConnections.businessId, connection.businessId),
          )).limit(1).for("update");
          if (other) return "already_linked_elsewhere" as const;
          const values = toValues({ ...connection, status: "connected", disconnectedAt: null });
          await tx.insert(mercadopagoConnections).values(values).onConflictDoUpdate({
            target: mercadopagoConnections.businessId,
            set: {
              mpUserId: values.mpUserId,
              accessTokenEnc: values.accessTokenEnc,
              refreshTokenEnc: values.refreshTokenEnc,
              publicKey: values.publicKey,
              scope: values.scope,
              liveMode: values.liveMode,
              expiresAt: values.expiresAt,
              connectedAt: values.connectedAt,
              refreshedAt: values.refreshedAt,
              status: values.status,
              lastError: values.lastError,
              disconnectedAt: values.disconnectedAt,
              consentVersion: values.consentVersion,
              consentTextSha256: values.consentTextSha256,
              autoRefundAckAt: values.autoRefundAckAt,
              consentUserId: values.consentUserId,
              accountDisplayName: values.accountDisplayName,
              accountEmailMasked: values.accountEmailMasked,
              updatedAt: values.updatedAt,
            },
          });
          return "ok" as const;
        });
      } catch (error) {
        if (postgresCode(error) === "23505") return "already_linked_elsewhere";
        throw error;
      }
    },
    async deleteByBusinessId(businessId) {
      await database.delete(mercadopagoConnections).where(eq(mercadopagoConnections.businessId, businessId));
    },
    async markDeauthorized(mpUserId) {
      return markMpUserDeauthorized(database, mpUserId);
    },
    async markDisconnected(businessId, disconnectedAt) {
      await database.update(mercadopagoConnections).set({
        status: "disconnected",
        disconnectedAt,
        updatedAt: new Date(),
      }).where(and(eq(mercadopagoConnections.businessId, businessId), ne(mercadopagoConnections.status, "disconnected")));
    },
    async clearDisconnectedTokens(businessId) {
      await database.update(mercadopagoConnections).set({
        accessTokenEnc: null,
        refreshTokenEnc: null,
        updatedAt: new Date(),
      }).where(and(eq(mercadopagoConnections.businessId, businessId), eq(mercadopagoConnections.status, "disconnected")));
    },
    async listDisconnectedWithTokens() {
      const rows = await database.select().from(mercadopagoConnections).where(and(
        eq(mercadopagoConnections.status, "disconnected"),
        isNotNull(mercadopagoConnections.accessTokenEnc),
        isNotNull(mercadopagoConnections.refreshTokenEnc),
      ));
      return rows.map(fromRow);
    },
    async disconnectTokenHold(businessId, now = new Date()): Promise<DisconnectTokenHold> {
      const freshAfter = new Date(now.getTime() - MP_DISCONNECT_STUCK_PIX_MS);
      const [row] = await database.select({
        hasOpenPix: sql<boolean | null>`bool_or(
          (${payments.status} in ('creating', 'pending') and (${payments.expiresAt} is null or ${payments.expiresAt} >= ${freshAfter}))
          or ${payments.refundStatus} = 'in_process'
          -- Nome da tabela de fora: a coluna interpolada vira "id" e o Postgres amarra na payment_refunds.
          or exists (
            select 1 from payment_refunds r
            where r.business_id = payments.business_id
              and r.payment_id = payments.id
              and r.status in ('requested', 'processing')
          )
        )`,
        lastExpiresAt: sql<Date | string | null>`max(${payments.expiresAt})`,
        lastRemoteCancelledAt: sql<Date | string | null>`max(${payments.remoteCancelledAt})`,
      }).from(payments).where(eq(payments.businessId, businessId));
      return {
        hasOpenPix: row?.hasOpenPix === true,
        lastExpiresAt: asDate(row?.lastExpiresAt),
        lastRemoteCancelledAt: asDate(row?.lastRemoteCancelledAt),
      };
    },
    async saveOAuthState(row) {
      await database.insert(mercadopagoOauthStates).values(row);
    },
    async findOAuthState(state) {
      const [row] = await database.select().from(mercadopagoOauthStates).where(eq(mercadopagoOauthStates.state, state)).limit(1);
      if (!row) return null;
      return {
        state: row.state,
        businessId: row.businessId,
        returnTo: row.returnTo,
        consentVersion: row.consentVersion,
        consentTextSha256: row.consentTextSha256,
        autoRefundAckAt: row.autoRefundAckAt,
        consentUserId: row.consentUserId,
        expiresAt: row.expiresAt,
      };
    },
    async consumeOAuthState(state) {
      await database.delete(mercadopagoOauthStates).where(eq(mercadopagoOauthStates.state, state));
    },
    async recordConnectionEvent(event) {
      await database.insert(mpConnectionEvents).values({
        businessId: event.businessId,
        kind: event.kind,
        ip: event.ip,
        detail: event.detail ?? null,
        createdAt: event.createdAt,
      });
    },
    async updateAccountProfile(businessId, profile) {
      await database.update(mercadopagoConnections).set({
        accountDisplayName: profile.accountDisplayName,
        accountEmailMasked: profile.accountEmailMasked,
        updatedAt: new Date(),
      }).where(eq(mercadopagoConnections.businessId, businessId));
    },
    async listRefreshCandidates(expiresBefore) {
      const rows = await database.select({ businessId: mercadopagoConnections.businessId }).from(mercadopagoConnections).where(and(
        eq(mercadopagoConnections.status, "connected"),
        lt(mercadopagoConnections.expiresAt, expiresBefore),
      ));
      return rows.map((row) => row.businessId);
    },
    async withBusinessLock(businessId, run) {
      return database.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(74821, hashtext(${businessId}))`);
        return run({
          async read() {
            const [row] = await tx.select().from(mercadopagoConnections).where(eq(mercadopagoConnections.businessId, businessId)).limit(1).for("update");
            return row ? fromRow(row) : null;
          },
          async write(next) {
            const values = toValues(next);
            const [updated] = await tx.update(mercadopagoConnections).set(values).where(eq(mercadopagoConnections.businessId, businessId)).returning({ businessId: mercadopagoConnections.businessId });
            if (!updated) await tx.insert(mercadopagoConnections).values(values);
          },
        });
      });
    },
  };
}
