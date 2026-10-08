import { MP_CONNECT_CONSENT_VERSION } from "./consent";
import { MP_AUTO_REFUND_ACK_ERROR } from "./connect-copy";

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
};

export const MP_ACCOUNT_NOT_CONNECTED = "mp_account_not_connected";

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
    message: "A conexão não foi concluída a tempo. Nenhuma permissão foi salva. Tente de novo; leva menos de um minuto.",
  },
  expired_code: {
    tone: "warning",
    message: "A conexão não foi concluída a tempo. Nenhuma permissão foi salva. Tente de novo; leva menos de um minuto.",
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

/** Normaliza o GET de status. `hadLegacyPixKey` ausente ou não-true vira false. */
export function parseMpOwnerStatus(value: unknown): MpOwnerStatus | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!isMpConnectionStatus(row.status)) return null;
  return {
    status: row.status,
    connectedAt: typeof row.connectedAt === "string" ? row.connectedAt : null,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
    liveMode: typeof row.liveMode === "boolean" ? row.liveMode : null,
    canReceiveDeposits: row.canReceiveDeposits === true,
    hadLegacyPixKey: row.hadLegacyPixKey === true,
    consentVersion: typeof row.consentVersion === "string" && row.consentVersion.length > 0 ? row.consentVersion : null,
  };
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

export type MpBannerId = "mp-reauth" | "mp-not-connected";

/**
 * Banners que dependem só do status da conexão ou de `blockedReason`.
 * Variantes de pagamento (pago após desconectar, conferência, devolução) ficam de fora.
 */
export function selectMpBanners(input: {
  status: MpConnectionStatus;
  hasDepositService: boolean;
  blockedReasons?: readonly string[];
}): MpBannerId[] {
  if (input.status === "needs_reconnect") return ["mp-reauth"];
  if (input.status === "connected") return [];
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
  const parts = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value?.replace(".", "");
  const year = parts.find((part) => part.type === "year")?.value;
  if (!day || !month || !year) return null;
  return `${day} ${month} ${year}`;
}

export function openPixDisconnectNote(count: number): string | null {
  if (!Number.isInteger(count) || count <= 0) return null;
  const lead = count === 1 ? "1 cliente está" : `${count} clientes estão`;
  return `${lead} com Pix em aberto. Se pagarem dentro do prazo, o agendamento é confirmado, o dinheiro cai na sua conta Mercado Pago e avisamos você. Até lá, o acesso à sua conta fica guardado só para conferir esses Pix e é apagado em até 45 minutos.`;
}

export function depositUnavailable(service: { bookable?: boolean; reason?: string | null }): boolean {
  return service.bookable === false && service.reason === MP_ACCOUNT_NOT_CONNECTED;
}

export function showDepositUnavailableCard(services: readonly { depositCents: number; bookable?: boolean; reason?: string | null }[]): boolean {
  return services.length > 0 && services.every((service) => service.depositCents > 0 && depositUnavailable(service));
}

export function hasBookableService(services: readonly { bookable?: boolean; reason?: string | null }[]): boolean {
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
  { strong: "devolver um sinal quando você mandar", rest: ", pelo botão \"Devolver pelo AgendaPix\". O valor sai do saldo da sua conta Mercado Pago;" },
  {
    strong: "devolver sozinho o valor inteiro",
    rest: ` em um único caso: quando o cliente paga depois do prazo de ${DEPOSIT_HOLD_MINUTES} minutos e o horário já está ocupado. Você recebe um e-mail a cada devolução;`,
  },
  { strong: "manter a conexão ativa", rest: " sem pedir sua autorização de novo a cada renovação." },
];
