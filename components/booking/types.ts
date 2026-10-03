export interface PublicService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
}

export interface PublicBusinessData {
  name: string;
  timezone: string;
  services: PublicService[];
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityResponse {
  timezone: string;
  slots: AvailabilitySlot[];
}

export interface PixPaymentData {
  id: string;
  provider: string;
  externalId: string;
  amountCents: number;
  status: "pending" | "paid" | "expired" | "failed" | "refunded";
  expiresAt: string;
  qrCodeDataUrl: string | null;
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
}
