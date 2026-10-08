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
  consentVersion: string | null;
  consentTextSha256: string | null;
  autoRefundAckAt: Date | null;
  consentUserId: string | null;
};

export type MpOAuthState = {
  state: string;
  businessId: string;
  returnTo: string;
  consentVersion: string;
  consentTextSha256: string;
  autoRefundAckAt: Date;
  consentUserId: string;
  expiresAt: Date;
};

export type MpConsentEvent = {
  businessId: string;
  kind: "consent_recorded";
  ip: string | null;
  createdAt: Date;
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
  saveOAuthState(row: MpOAuthState): Promise<void>;
  findOAuthState(state: string): Promise<MpOAuthState | null>;
  consumeOAuthState(state: string): Promise<void>;
  recordConsentEvent(event: MpConsentEvent): Promise<void>;
};
