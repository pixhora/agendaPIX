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

/** `creating`/`pending` mais velho que isto não segura o token. O status no Mercado Pago não muda. */
export const MP_DISCONNECT_STUCK_PIX_MS = 7 * 24 * 60 * 60 * 1000;

/** O que ainda segura o token depois de desconectar pelo AgendaPix. */
export type DisconnectTokenHold = {
  /**
   * Pagamento `creating`/`pending` com `expires_at` nulo ou com menos de 7 dias,
   * ou devolução ainda aberta: `payment_refunds.status` `requested` ou `processing`.
   * `payments.refund_status = in_process` também segura. `refunded`, `rejected` e `failed` não.
   */
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
  disconnectTokenHold(businessId: string, now?: Date): Promise<DisconnectTokenHold>;
  listRefreshCandidates(expiresBefore: Date): Promise<string[]>;
  withBusinessLock<T>(businessId: string, run: (lock: MpLock) => Promise<T>): Promise<T>;
  saveOAuthState(row: MpOAuthState): Promise<void>;
  findOAuthState(state: string): Promise<MpOAuthState | null>;
  consumeOAuthState(state: string): Promise<void>;
  recordConnectionEvent(event: MpConnectionEvent): Promise<void>;
  updateAccountProfile(businessId: string, profile: { accountDisplayName: string | null; accountEmailMasked: string | null }): Promise<void>;
};
