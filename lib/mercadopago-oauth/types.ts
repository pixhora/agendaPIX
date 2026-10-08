export type MpConnectionStatus = "connected" | "needs_reconnect" | "disconnected";

export type MpConnection = {
  businessId: string;
  mpUserId: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  publicKey: string | null;
  scope: string | null;
  liveMode: boolean | null;
  expiresAt: Date | null;
  connectedAt: Date;
  refreshedAt: Date | null;
  status: MpConnectionStatus;
  lastError: string | null;
  disconnectedAt: Date | null;
};

export type MpLock = {
  read(): Promise<MpConnection | null>;
  write(next: MpConnection): Promise<void>;
};

export type MpConnectionStore = {
  findByBusinessId(businessId: string): Promise<MpConnection | null>;
  findConnectedBusinessId(mpUserId: string): Promise<string | null>;
  saveConnected(connection: MpConnection): Promise<"ok" | "already_linked_elsewhere">;
  deleteByBusinessId(businessId: string): Promise<void>;
  markDeauthorized(mpUserId: string): Promise<void>;
  markDisconnected(businessId: string, disconnectedAt: Date): Promise<void>;
  clearDisconnectedTokens(businessId: string): Promise<void>;
  listDisconnectedWithTokens(): Promise<MpConnection[]>;
  latestPendingDepositExpiresAt(businessId: string): Promise<Date | null>;
  listRefreshCandidates(expiresBefore: Date): Promise<string[]>;
  withBusinessLock<T>(businessId: string, run: (lock: MpLock) => Promise<T>): Promise<T>;
};
