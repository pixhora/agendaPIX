import { MP_CONNECT_CONSENT_VERSION } from "./consent";
import { latePixRefundCopy } from "./late-pix-copy";
import { MP_AUTO_REFUND_ACK_ERROR, MP_MANUAL_REFUND_CHANNEL } from "./connect-copy";

/** Status visto pelo dono. Campo ausente de chave antiga vale como false. */
export const MP_CONNECTION_STATUSES = ["not_connected", "connected", "needs_reconnect"] as const;
export type MpConnectionStatus = (typeof MP_CONNECTION_STATUSES)[number];

export const MP_CALLBACK_REASONS = [
  "access_denied",
  "state_mismatch",
  "expired_code",
  "exchange_failed",
  "already_linked_elsewhere",
  "auto_refund_ack_required",
] as const;
export type MpCallbackReason = (typeof MP_CALLBACK_REASONS)[number];

export type MpReturnTo = "/dashboard" | "/onboarding";

export type MpOwnerStatus = {
  status: MpConnectionStatus;
  connectedAt: string | null;
  expiresAt: string | null;
  liveMode: boolean | null;
  canReceiveDeposits: boolean;
  hadLegacyPixKey: boolean;
  consentVersion: string | null;
  accountName: string | null;
  accountEmailMasked: string | null;
  accountIdLast4: string | null;
};

export const MP_ACCOUNT_NOT_CONNECTED = "mp_account_not_connected";

export const MP_CONSENT_OUTDATED = "mp_consent_outdated";

export const AUTO_REFUND_ACK_ERROR = MP_AUTO_REFUND_ACK_ERROR;

export const LEGACY_PIX_NOTICE =
  "A chave Pix que você cadastrou antes não é mais usada. Agora o sinal cai direto na sua conta Mercado Pago.";

export const CONNECTED_TOAST = "Conta Mercado Pago conectada.";
export const DISCONNECTED_TOAST = "Mercado Pago desconectado.";

export const DEPOSIT_HOLD_MINUTES = 30;

const CALLBACK_COPY: Record<MpCallbackReason, { tone: "danger" | "warning" | "ack"; message: string }> = {
  access_denied: {
    tone: "warning",
    message:
      "A conexão não foi concluída. Sem ela, você ainda pode configurar sua agenda, mas os serviços com sinal ficam indisponíveis para os clientes.",
  },
  state_mismatch: {
    tone: "warning",
    message: "A conexão não foi concluída a tempo. Nenhuma permissão foi salva. Tente de novo.",
  },
  expired_code: {
    tone: "warning",
    message: "A conexão não foi concluída a tempo. Nenhuma permissão foi salva. Tente de novo.",
  },
  exchange_failed: {
    tone: "danger",
    message: "Não conseguimos concluir a conexão com o Mercado Pago agora. Nenhuma permissão foi salva. Tente de novo em alguns minutos.",
  },
  already_linked_elsewhere: {
    tone: "warning",
    message: "Essa conta Mercado Pago já está ligada a outro negócio no AgendaPix. Conecte outra conta.",
  },
  auto_refund_ack_required: {
    tone: "ack",
    message: AUTO_REFUND_ACK_ERROR,
  },
};

export function isMpConnectionStatus(value: unknown): value is MpConnectionStatus {
  return value === "not_connected" || value === "connected" || value === "needs_reconnect";
}

export function isMpCallbackReason(value: unknown): value is MpCallbackReason {
  return typeof value === "string" && (MP_CALLBACK_REASONS as readonly string[]).includes(value);
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalLast4(value: unknown): string | null {
  const text = optionalText(value);
  return text && /^\d{4}$/.test(text) ? text : null;
}

/** Normaliza o GET de status. `hadLegacyPixKey` ausente ou não-true vira false. Sem conexão, a conta não sai. */
export function parseMpOwnerStatus(value: unknown): MpOwnerStatus | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!isMpConnectionStatus(row.status)) return null;
  const connected = row.status !== "not_connected";
  return {
    status: row.status,
    connectedAt: typeof row.connectedAt === "string" ? row.connectedAt : null,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
    liveMode: typeof row.liveMode === "boolean" ? row.liveMode : null,
    canReceiveDeposits: row.canReceiveDeposits === true,
    hadLegacyPixKey: row.hadLegacyPixKey === true,
    consentVersion: typeof row.consentVersion === "string" && row.consentVersion.length > 0 ? row.consentVersion : null,
    accountName: connected ? optionalText(row.accountName) : null,
    accountEmailMasked: connected ? optionalText(row.accountEmailMasked) : null,
    accountIdLast4: connected ? optionalLast4(row.accountIdLast4) : null,
  };
}

export type MpAccountIdentity = { title: string; detail: string | null };

/** Nome e e-mail quando os dois vêm; só o e-mail quando o nome falta; senão o número com os 4 últimos dígitos. */
export function mpAccountIdentity(status: Pick<MpOwnerStatus, "accountName" | "accountEmailMasked" | "accountIdLast4">): MpAccountIdentity | null {
  if (status.accountName && status.accountEmailMasked) {
    return { title: status.accountName, detail: status.accountEmailMasked };
  }
  if (!status.accountName && status.accountEmailMasked) {
    return { title: status.accountEmailMasked, detail: null };
  }
  if (status.accountIdLast4) {
    return { title: `Conta Mercado Pago nº ••••${status.accountIdLast4}`, detail: null };
  }
  return null;
}

/** A caixa volta quando a versão aceita falta ou é diferente da tela atual. */
export function reconnectRequiresAck(consentVersion: string | null | undefined): boolean {
  return consentVersion !== MP_CONNECT_CONSENT_VERSION;
}

export function gateConnectSubmit(acknowledged: boolean): { ok: true } | { ok: false; message: string } {
  if (acknowledged) return { ok: true };
  return { ok: false, message: AUTO_REFUND_ACK_ERROR };
}

export function mpConnectAction(businessId: string): string {
  return `/api/businesses/${encodeURIComponent(businessId)}/mercadopago/connect`;
}

export function mpConnectionUrl(businessId: string): string {
  return `/api/businesses/${encodeURIComponent(businessId)}/mercadopago`;
}

/** Aceite da versão vigente sem abrir o Mercado Pago de novo. */
export function mpConsentUrl(businessId: string): string {
  return `/api/businesses/${encodeURIComponent(businessId)}/mercadopago/consent`;
}

export function legacyPixDismissUrl(businessId: string): string {
  return `/api/businesses/${encodeURIComponent(businessId)}/notices/pix_key_retired/dismiss`;
}

export function legacyNoticeVisible(hadLegacyPixKey: boolean | undefined, dismissed: boolean): boolean {
  return hadLegacyPixKey === true && !dismissed;
}

/** 204 esconde o aviso. Qualquer outra resposta mantém. */
export function legacyNoticeAfterDismiss(status: number): "hidden" | "visible" {
  return status === 204 ? "hidden" : "visible";
}

export function showsTestMode(liveMode: boolean | null | undefined): boolean {
  return liveMode === false;
}

export type MpStatusBadgeTone = "connected" | "not_connected" | "needs_reconnect";

export function statusBadge(status: MpConnectionStatus): { tone: MpStatusBadgeTone; label: string } {
  if (status === "connected") return { tone: "connected", label: "Conectado" };
  if (status === "needs_reconnect") return { tone: "needs_reconnect", label: "Desconectado" };
  return { tone: "not_connected", label: "Não conectado" };
}

export type MpBannerId = "mp-reauth" | "mp-not-connected" | "mp-consent";

/**
 * Banners que dependem só do status da conexão ou de `blockedReason`.
 * Variantes de pagamento (pago após desconectar, conferência, devolução) ficam de fora.
 */
export function selectMpBanners(input: {
  status: MpConnectionStatus;
  hasDepositService: boolean;
  blockedReasons?: readonly string[];
  /** Conta ainda conectada, mas o texto aceito não é o vigente. */
  consentOutdated?: boolean;
}): MpBannerId[] {
  if (input.status === "needs_reconnect") return ["mp-reauth"];
  if (input.status === "connected") return input.consentOutdated ? ["mp-consent"] : [];
  const blocked = input.blockedReasons?.includes(MP_ACCOUNT_NOT_CONNECTED) ?? false;
  if (input.hasDepositService || blocked) return ["mp-not-connected"];
  return [];
}

export type MpCallbackView =
  | { mp: "connected"; toast: string }
  | { mp: "error"; reason: MpCallbackReason | "unknown"; tone: "danger" | "warning" | "ack"; message: string; toast: string };

export function presentMpCallback(mp: string | null, reason: string | null): MpCallbackView | null {
  if (mp === "connected") return { mp: "connected", toast: CONNECTED_TOAST };
  if (mp !== "error") return null;
  if (isMpCallbackReason(reason)) {
    const copy = CALLBACK_COPY[reason];
    return { mp: "error", reason, tone: copy.tone, message: copy.message, toast: copy.message };
  }
  const fallback = CALLBACK_COPY.exchange_failed;
  return { mp: "error", reason: "unknown", tone: fallback.tone, message: fallback.message, toast: fallback.message };
}

export function callbackFocusesAck(view: MpCallbackView | null): boolean {
  return view?.mp === "error" && view.reason === "auto_refund_ack_required";
}

export function formatConnectedSince(iso: string | null, timeZone = "America/Sao_Paulo"): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone }).format(date);
}

/**
 * Teto que a tela pode prometer. Os crons da Vercel rodam uma vez por dia
 * (`vercel.json`: reconcile às 06:00 UTC, refresh às 07:15 UTC). O worker Docker
 * chama o mesmo apagamento em cada passagem do reconciliador.
 */
export const MP_DISCONNECT_TOKEN_MAX_HOURS = 24;

/** Sem Pix em aberto o acesso some na hora. Com Pix em aberto, o aviso abaixo diz o teto. */
export function disconnectAccessSentence(pendingPixCount: number): string {
  if (pendingPixCount > 0) {
    return "Enquanto houver Pix em aberto, o AgendaPix guarda o acesso à sua conta só para confirmar o pagamento ou devolver o sinal se ele chegar fora do prazo. Quando esses Pix forem pagos, vencerem ou forem cancelados, o acesso é apagado.";
  }
  return "O AgendaPix apaga agora o acesso à sua conta. Devoluções, a partir de agora, inclusive as de Pix pago fora do prazo, você faz direto no Mercado Pago.";
}

export function openPixDisconnectNote(count: number): string | null {
  if (!Number.isInteger(count) || count <= 0) return null;
  const one = count === 1;
  const lead = one ? "1 cliente está" : `${count} clientes estão`;
  const pay = one ? "Se pagar" : "Se pagarem";
  const pix = one ? "esse Pix" : "esses Pix";
  const after = one
    ? "ele for pago, vencer ou for cancelado"
    : "eles forem pagos, vencerem ou forem cancelados";
  return `${lead} com Pix em aberto. ${pay} dentro do prazo, o agendamento é confirmado, o dinheiro cai na sua conta Mercado Pago e avisamos você. O acesso à sua conta fica guardado só para conferir ${pix} e é apagado em até ${MP_DISCONNECT_TOKEN_MAX_HOURS} horas depois que ${after}.`;
}

type DepositFlag = { bookable?: boolean; reason?: string | null; blockedReason?: string | null };

function depositBlockReason(service: DepositFlag): string | null {
  return service.reason ?? service.blockedReason ?? null;
}

export function depositUnavailable(service: DepositFlag): boolean {
  const reason = depositBlockReason(service);
  return service.bookable === false && (reason === MP_ACCOUNT_NOT_CONNECTED || reason === MP_CONSENT_OUTDATED || reason === "mp_account_test_mode");
}

export function showDepositUnavailableCard(services: readonly (DepositFlag & { depositCents: number })[]): boolean {
  return services.length > 0 && services.every((service) => service.depositCents > 0 && depositUnavailable(service));
}

export function hasBookableService(services: readonly DepositFlag[]): boolean {
  return services.some((service) => !depositUnavailable(service));
}

const BANNER_DISMISS_MS = 24 * 60 * 60 * 1000;

export function bannerDismissStorageKey(businessId: string, banner: MpBannerId): string {
  return `agendapix.mp.banner.${businessId}.${banner}`;
}

export function bannerHiddenUntil(raw: string | null, now: number): boolean {
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && until > now;
}

export function bannerDismissUntil(now: number): number {
  return now + BANNER_DISMISS_MS;
}

export const MP_CALLBACK_STORAGE_KEY = "agendapix.mp.callback";

export const MP_TARIFF_URL = "https://www.mercadopago.com.br/ferramentas-para-vender/check-out";

export const PERMISSIONS: { strong: string; rest: string }[] = [
  { strong: "criar cobranças Pix", rest: " no valor do sinal dos seus agendamentos;" },
  { strong: "ver o status", rest: " dessas cobranças, para confirmar o agendamento quando o cliente pagar;" },
  { strong: "cancelar", rest: " cobranças que não foram pagas no prazo;" },
  { strong: "devolver um sinal quando você mandar", rest: `. ${MP_MANUAL_REFUND_CHANNEL} O valor sai do saldo da sua conta Mercado Pago;` },
  {
    strong: "devolver sozinho o valor inteiro",
    rest: ` quando um Pix chega depois do prazo. ${latePixRefundCopy("refund")} Você recebe um e-mail a cada devolução;`,
  },
  { strong: "manter a conexão ativa", rest: " sem pedir sua autorização de novo a cada renovação." },
];
