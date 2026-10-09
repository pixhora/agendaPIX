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
  accountDisplayName: string | null;
  accountEmailMasked: string | null;
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

export type MpConnectionEvent = {
  businessId: string;
  kind: "consent_recorded" | "account_profile_failed";
  ip: string | null;
  detail?: string | null;
  createdAt: Date;
};

export type MpLock = {
  read(): Promise<MpConnection | null>;
  write(next: MpConnection): Promise<void>;
};

/** O que ainda segura o token depois de desconectar pelo AgendaPix. */
export type DisconnectTokenHold = {
  /** Ainda existe pagamento `creating` ou `pending`. */
  hasOpenPix: boolean;
  /** Maior `expires_at` dos pagamentos deste negócio, aberto ou já encerrado. */
  lastExpiresAt: Date | null;
  /** Maior `remote_cancelled_at`. A folga de 24 h conta a partir do mais recente dos dois. */
  lastRemoteCancelledAt: Date | null;
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
  disconnectTokenHold(businessId: string): Promise<DisconnectTokenHold>;
  listRefreshCandidates(expiresBefore: Date): Promise<string[]>;
  withBusinessLock<T>(businessId: string, run: (lock: MpLock) => Promise<T>): Promise<T>;
  saveOAuthState(row: MpOAuthState): Promise<void>;
  findOAuthState(state: string): Promise<MpOAuthState | null>;
  consumeOAuthState(state: string): Promise<void>;
  recordConnectionEvent(event: MpConnectionEvent): Promise<void>;
  updateAccountProfile(businessId: string, profile: { accountDisplayName: string | null; accountEmailMasked: string | null }): Promise<void>;
};
