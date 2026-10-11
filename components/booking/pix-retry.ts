import { publicBookingPaymentUrl } from "@/lib/public-api";
import type { PixResumeSession } from "./pix-resume";

/**
 * Busca de novo o Pix da reserva que já está neste separador.
 * O accessToken sai do sessionStorage e vai só no header.
 * A URL não leva o token. Este caminho é GET: não cria reserva e não manda Idempotency-Key.
 */
export function pixRetryPaymentRequest(slug: string, session: PixResumeSession): { url: string; init: RequestInit } {
  const url = publicBookingPaymentUrl(slug, session.bookingId);
  if (url.includes(session.accessToken)) throw new Error("pix_retry_token_in_url");
  return {
    url,
    init: {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    },
  };
}
