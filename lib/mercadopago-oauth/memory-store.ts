import type { MpConnection, MpConnectionStore } from "./types";

function clone(row: MpConnection): MpConnection {
  return {
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    connectedAt: new Date(row.connectedAt),
    refreshedAt: row.refreshedAt ? new Date(row.refreshedAt) : null,
    disconnectedAt: row.disconnectedAt ? new Date(row.disconnectedAt) : null,
  };
}

/** Store em memória com o mesmo contrato do Postgres, inclusive o lock por negócio. Só para testes. */
export function createMemoryMpStore(seed: MpConnection[] = []): MpConnectionStore & { pendingExpiresAt: Map<string, Date | null> } {
  const rows = new Map<string, MpConnection>();
  for (const row of seed) rows.set(row.businessId, clone(row));
  const pendingExpiresAt = new Map<string, Date | null>();
  const locks = new Map<string, Promise<void>>();

  async function withKeyLock<T>(key: string, run: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    locks.set(key, previous.then(() => gate));
    await previous;
    try { return await run(); }
    finally { release(); }
  }

  return {
    pendingExpiresAt,
    async findByBusinessId(businessId) {
      const row = rows.get(businessId);
      return row ? clone(row) : null;
    },
    async findConnectedBusinessId(mpUserId) {
      for (const row of rows.values()) {
        if (row.mpUserId === mpUserId && row.status === "connected") return row.businessId;
      }
      return null;
    },
    async saveConnected(connection) {
      return withKeyLock(`user:${connection.mpUserId}`, async () => {
        for (const row of rows.values()) {
          if (row.mpUserId === connection.mpUserId && row.status === "connected" && row.businessId !== connection.businessId) {
            return "already_linked_elsewhere";
          }
        }
        rows.set(connection.businessId, clone({ ...connection, status: "connected", disconnectedAt: null }));
        return "ok";
      });
    },
    async deleteByBusinessId(businessId) {
      rows.delete(businessId);
    },
    async markDeauthorized(mpUserId) {
      for (const row of rows.values()) {
        if (row.mpUserId !== mpUserId) continue;
        rows.set(row.businessId, {
          ...row,
          status: "needs_reconnect",
          accessTokenEnc: null,
          refreshTokenEnc: null,
          lastError: "application.deauthorized",
          disconnectedAt: null,
        });
      }
    },
    async markDisconnected(businessId, disconnectedAt) {
      const row = rows.get(businessId);
      if (!row || row.status === "disconnected") return;
      rows.set(businessId, { ...row, status: "disconnected", disconnectedAt: new Date(disconnectedAt) });
    },
    async clearDisconnectedTokens(businessId) {
      const row = rows.get(businessId);
      if (!row || row.status !== "disconnected") return;
      rows.set(businessId, { ...row, accessTokenEnc: null, refreshTokenEnc: null });
    },
    async listDisconnectedWithTokens() {
      return [...rows.values()].filter((row) => row.status === "disconnected" && row.accessTokenEnc && row.refreshTokenEnc).map(clone);
    },
    async latestPendingDepositExpiresAt(businessId) {
      return pendingExpiresAt.has(businessId) ? pendingExpiresAt.get(businessId) ?? null : null;
    },
    async listRefreshCandidates(expiresBefore) {
      return [...rows.values()]
        .filter((row) => row.status === "connected" && row.expiresAt !== null && row.expiresAt.getTime() < expiresBefore.getTime())
        .map((row) => row.businessId);
    },
    async withBusinessLock(businessId, run) {
      return withKeyLock(`biz:${businessId}`, () => run({
        async read() {
          const row = rows.get(businessId);
          return row ? clone(row) : null;
        },
        async write(next) {
          rows.set(businessId, clone(next));
        },
      }));
    },
  };
}
