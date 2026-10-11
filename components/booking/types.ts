/** Linha da folha de detalhes, já escrita pelo servidor. A UI não monta esse texto. */
export interface PolicyDetailLine {
  title: string;
  body: string;
  tone?: "ok" | "warn";
}

/** Espelho opcional de `depositPolicy`. A UI não gera frase a partir dele. */
export interface DepositPolicy {
  version?: 1;
  preset?: "flexivel" | "padrao" | "rigida" | "personalizada";
  refundUntilHours?: 2 | 12 | 24 | 48 | null;
  rescheduleUntilHours?: 2 | 12 | 24 | 48 | null;
  maxReschedules?: number;
  lateCancel?: "retain" | "credit";
  noShow?: "retain" | "credit" | "refund";
  creditValidityDays?: number;
}

export interface PublicService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  /** Foto do serviço, já validada pelo servidor. Ausente ou nula: sem foto. */
  imageUrl?: string | null;
  /** `false`: o serviço não aceita reserva (sem botão). Ausente: reservável. */
  bookable?: boolean;
  /** Motivo interno quando `bookable` é false. A tela não mostra o código. */
  reason?: string | null;
  /** Mesmo papel de `reason`, no nome que a API pública devolve. */
  blockedReason?: string | null;
  depositPolicy?: DepositPolicy | null;
  /**
   * Linha única vinda do servidor.
   * Ausente (campo nem veio): serviço antigo, sem linha e sem bloqueio.
   * Veio vazio, ou só o resumo ou só o hash: o Pix fica bloqueado.
   */
  policySummary?: string | null;
  policyHash?: string | null;
  /** Linhas da folha, se o servidor enviar. Senão a folha mostra `policySummary`. */
  policyDetails?: PolicyDetailLine[] | null;
}

export interface PublicBusinessData {
  name: string;
  timezone: string;
  services: PublicService[];
  /** Endereço/cidade exibidos no cabeçalho se o backend enviar. */
  address?: string | null;
  /** Telefone/WhatsApp do negócio (só dígitos ou formatado). */
  phone?: string | null;
  /** Logo do negócio; se ausente, o avatar usa ícone CalendarCheck. */
  logoUrl?: string | null;
  /** WhatsApp em E.164. A página pausada e o comprovante usam este campo. */
  contactWhatsapp?: string | null;
  bookingsPaused?: boolean;
  /**
   * `false`: esconde o CPF e não envia no pedido.
   * Ausente: ainda pede CPF, porque a cobrança atual exige o documento.
   */
  requiresPayerCpf?: boolean;
  /** Nome que o app do banco mostra. Vazio: a frase do recebedor não aparece. */
  pixRecipientDisplayName?: string | null;
  /** Segmento, se o backend enviar. A página pausada mostra quando vier. */
  segment?: string | null;
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityResponse {
  timezone: string;
  slots: AvailabilitySlot[];
  bookingsPaused?: boolean;
  /**
   * `false` em serviço com sinal: a reserva online está fechada.
   * `reason` é interno (ex.: conta de pagamento) e a tela não mostra.
   */
  bookable?: boolean;
  reason?: string;
}

/**
 * Espelho do contrato público de pagamento (ver docs/CONTRATOS.md + PixCharge).
 * Status do provider: pending | paid | expired | cancelled.
 * O DB pode ainda expor creating / failed / refunded / refund_pending na API pública.
 */
export type PixPaymentStatus =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled"
  | "creating"
  | "failed"
  | "refunded"
  | "refund_pending";

export interface PixPaymentData {
  id: string;
  provider: string;
  /** Id da cobrança no gateway (order ORDTST…/ORD… no Mercado Pago). */
  externalId: string | null;
  amountCents: number;
  status: PixPaymentStatus;
  /** Vencimento do Pix no servidor. Ausente: a UI não inventa prazo. */
  expiresAt?: string | null;
  /** QR local: `data:image/…`, `blob:` ou SVG. Sem URL externa. */
  qrCodeDataUrl: string | null;
  /** EMV copia-e-cola (`payment_method.qr_code` no Orders). */
  copyPaste: string | null;
}

/** Snapshot devolvido em `bookingView` / comprovante. */
export interface BookingPolicyView {
  text?: string | null;
  snapshot?: DepositPolicy | null;
  refundDeadlineAt?: string | null;
  rescheduleDeadlineAt?: string | null;
  /**
   * A reserva nasceu dentro da janela (`bookings.created_at`).
   * Com `true`, o comprovante usa o tom de aviso e `text` não traz data.
   */
  refundWindowClosedAtBooking?: boolean;
  /** Só se o payload já trouxer. Ausente: a tela de prazo usa a frase de política desconhecida. */
  latePaymentPolicy?: "refund" | "rebook_if_free" | null;
  /** Linhas da folha, se o servidor enviar junto do snapshot. */
  details?: PolicyDetailLine[] | null;
}

export interface BookingResponse {
  bookingId: string;
  status: "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";
  startsAt: string;
  endsAt: string;
  expiresAt: string | null;
  accessToken: string;
  payment: PixPaymentData | null;
  policy?: BookingPolicyView | null;
  /** Espelho opcional do GET de status. `true` abre a tela de falha do Pix. */
  chargeFailed?: boolean;
}

export type { PaymentStatusResponse } from "@/lib/public/payment-status";

export interface CustomerFormData {
  name: string;
  phone: string;
  cpfCnpj: string;
}

/** Campos de política que o `409 policy_changed` pode devolver. */
export interface PolicyChangedUpdate {
  policySummary: string | null;
  policyHash: string | null;
  depositPolicy: DepositPolicy | null;
  policyDetails: PolicyDetailLine[] | null;
}
