type Instant = Date | string | null | undefined;

function iso(value: Instant) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida na resposta pública.");
  return date.toISOString();
}

type PublicPayment = {
  expiresAt: Date | string;
  [key: string]: unknown;
};

/**
 * Resposta pública da reserva. `expiresAt` (ISO-8601) é o fim do hold e a validade do Pix,
 * o mesmo instante gravado na reserva e na cobrança.
 */
export function serializePublicBooking<T extends {
  startsAt: Date | string;
  endsAt: Date | string;
  expiresAt: Date | string | null;
  payment: PublicPayment | null;
}>(data: T) {
  const expiresAt = iso(data.expiresAt);
  return {
    ...data,
    startsAt: iso(data.startsAt),
    endsAt: iso(data.endsAt),
    expiresAt,
    payment: data.payment
      ? { ...data.payment, expiresAt: iso(data.payment.expiresAt) }
      : null,
  };
}
