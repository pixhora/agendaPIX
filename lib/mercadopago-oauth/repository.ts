import { and, desc, eq, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { mercadopagoConnections, payments } from "../../db/schema";
import type { MpConnection, MpConnectionStore } from "./types";

type Database = Pick<ReturnType<typeof getDb>, "select" | "insert" | "update" | "delete" | "transaction" | "execute">;
type Row = typeof mercadopagoConnections.$inferSelect;

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
    updatedAt: new Date(),
  };
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
      await database.update(mercadopagoConnections).set({
        status: "needs_reconnect",
        accessTokenEnc: null,
        refreshTokenEnc: null,
        lastError: "application.deauthorized",
        disconnectedAt: null,
        updatedAt: new Date(),
      }).where(eq(mercadopagoConnections.mpUserId, mpUserId));
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
    async latestPendingDepositExpiresAt(businessId) {
      const [row] = await database.select({ expiresAt: payments.expiresAt }).from(payments).where(and(
        eq(payments.businessId, businessId),
        inArray(payments.status, ["creating", "pending"]),
      )).orderBy(desc(payments.expiresAt)).limit(1);
      return row?.expiresAt ?? null;
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
