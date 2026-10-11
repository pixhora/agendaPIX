type Instant = Date | string | null;

type DerivablePayment = {
  status: string;
  expiresAt: Date | string;
  qrCodeDataUrl: string | null;
  copyPaste: string | null;
};

type DerivableBooking = {
  status: string;
  expiresAt: Instant;
  payment: DerivablePayment | null;
};

function millis(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Recusa definitiva: pagamento `failed` sem id no gateway. Não é hold vencido nem cobrança cancelada. */
export function chargeFailedForPayment(payment: { status: string; externalId: string | null } | null | undefined) {
  return Boolean(payment && payment.status === "failed" && !payment.externalId);
}

/** Mesma fronteira de `expirePending` (`expires_at <= now`) e do QR utilizável (`expires_at > now`). */
export function isDue(expiresAt: Instant, now: Date) {
  return expiresAt != null && millis(expiresAt) <= now.getTime();
}

/**
 * Estado público vencido, sem gravar. A expiração persistente continua em quem já escreve sob o lock.
 * QR e copia-e-cola só saem com cobrança `pending` ainda vigente.
 */
export function withDerivedExpiry<T extends DerivableBooking>(view: T, now: Date): T {
  const bookingExpired = view.status === "pending_payment" && isDue(view.expiresAt, now);
  const payment = view.payment;
  const paymentExpired = payment != null
    && (payment.status === "pending" || payment.status === "creating")
    && isDue(payment.expiresAt, now);
  const status = paymentExpired ? "expired" : payment?.status;
  const usable = status === "pending" && payment != null && !isDue(payment.expiresAt, now);
  return {
    ...view,
    status: bookingExpired ? "expired" : view.status,
    payment: payment
      ? {
          ...payment,
          status: status ?? payment.status,
          qrCodeDataUrl: usable ? payment.qrCodeDataUrl : null,
          copyPaste: usable ? payment.copyPaste : null,
        }
      : null,
  };
}
