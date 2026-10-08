export interface PublicService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  depositPolicy?: unknown;
  policySummary?: string | null;
  policyHash?: string | null;
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
  contactWhatsapp?: string | null;
  bookingsPaused?: boolean;
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityResponse {
  timezone: string;
  slots: AvailabilitySlot[];
  bookingsPaused?: boolean;
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
  externalId: string;
  amountCents: number;
  status: PixPaymentStatus;
  expiresAt: string;
  /** PNG gerado no backend a partir do EMV (`data:image/png;base64,…`). */
  qrCodeDataUrl: string | null;
  /** EMV copia-e-cola (`payment_method.qr_code` no Orders). */
  copyPaste: string | null;
}

export interface BookingResponse {
  bookingId: string;
  status: "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";
  startsAt: string;
  endsAt: string;
  expiresAt: string | null;
  accessToken: string;
  payment: PixPaymentData | null;
  policy?: {
    text: string | null;
    snapshot: unknown;
    refundDeadlineAt: string | null;
    rescheduleDeadlineAt: string | null;
  } | null;
}

export interface PaymentStatusResponse {
  bookingId: string;
  status: "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";
  expiresAt: string | null;
  payment: PixPaymentData | null;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  cpfCnpj: string;
}
