import { HttpError } from "../http";

/**
 * Único ponto da regra "serviço com sinal só é reservável se o negócio estiver apto".
 * Hoje sempre permite. Um PR futuro devolve `{ ok: false, code: "mp_account_not_connected" }`
 * quando a conta Mercado Pago do dono não estiver conectada. Não consulte chave Pix aqui.
 */
export type DepositBookability =
  | { ok: true }
  | { ok: false; status: 409; code: string; message: string };

export function getDepositBookability(business: { id: string }): DepositBookability {
  void business.id;
  return { ok: true };
}

/** Valores emitidos hoje em `blockedReason`: `null` e `bookings_paused`. Códigos de `getDepositBookability` entram aqui quando a função deixar de retornar ok. */
export function resolveServiceBookability(
  access: { bookingsPaused: boolean },
  service: { depositCents: number },
  deposit: DepositBookability,
): { bookable: boolean; blockedReason: string | null } {
  if (access.bookingsPaused) return { bookable: false, blockedReason: "bookings_paused" };
  if (service.depositCents > 0 && !deposit.ok) return { bookable: false, blockedReason: deposit.code };
  return { bookable: true, blockedReason: null };
}

export function serviceListingBookability(
  business: { id: string },
  service: { depositCents: number },
  access: { bookingsPaused: boolean },
) {
  return resolveServiceBookability(access, service, getDepositBookability(business));
}

export function assertDepositBookable(business: { id: string }) {
  const bookability = getDepositBookability(business);
  if (!bookability.ok) throw new HttpError(bookability.status, bookability.code, bookability.message);
}
