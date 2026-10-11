import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { bookingAccessSecret, bookingAccessSecretPrevious } from "../env";

type MacEncoding = "hex" | "base64url";

/** Compara em tempo constante. Tamanhos diferentes não passam e não estouram o `timingSafeEqual`. */
export function timingSafeStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function mac(secret: string, message: string, encoding: MacEncoding) {
  return createHmac("sha256", secret).update(message).digest(encoding);
}

/** HMAC só com o segredo atual. Token novo não usa o anterior. */
export function bookingAccessMac(message: string, encoding: MacEncoding, env: Readonly<Record<string, string | undefined>> = process.env) {
  const secret = bookingAccessSecret(env);
  if (!secret) return null;
  return mac(secret, message, encoding);
}

/**
 * Verdadeiro se `presented` é o HMAC do segredo atual ou, quando existe, do anterior.
 * As duas comparações rodam antes do resultado, para o tempo não dizer qual bateu.
 * Sem `BOOKING_ACCESS_SECRET_PREVIOUS`, o valor antigo de `BETTER_AUTH_SECRET` não entra.
 */
export function bookingAccessMacMatches(
  presented: string,
  message: string,
  encoding: MacEncoding,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const currentSecret = bookingAccessSecret(env);
  if (!currentSecret) return false;
  const currentMac = mac(currentSecret, message, encoding);
  const previousSecret = bookingAccessSecretPrevious(env);
  const previousMac = previousSecret ? mac(previousSecret, message, encoding) : currentMac;
  const currentOk = timingSafeStringEqual(presented, currentMac);
  const previousOk = previousSecret ? timingSafeStringEqual(presented, previousMac) : false;
  return currentOk || previousOk;
}

export function bookingAccessTokenMessage(businessId: string, bookingId: string) {
  return `booking-access:v1:${businessId}:${bookingId}`;
}

/** Token novo do acompanhamento da reserva. Só o segredo atual. */
export function signBookingAccessToken(
  businessId: string,
  bookingId: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return bookingAccessMac(bookingAccessTokenMessage(businessId, bookingId), "base64url", env);
}

/** Aceita o token assinado com o segredo atual ou com o anterior. */
export function bookingAccessTokenMatches(
  token: string,
  businessId: string,
  bookingId: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return bookingAccessMacMatches(token, bookingAccessTokenMessage(businessId, bookingId), "base64url", env);
}

function storedTokenHashMatches(token: string, accessTokenHash: string | null) {
  const presented = createHash("sha256").update(token).digest("hex");
  if (!accessTokenHash || !/^[a-f0-9]{64}$/.test(accessTokenHash)) {
    timingSafeStringEqual(presented, presented);
    return false;
  }
  return timingSafeStringEqual(presented, accessTokenHash);
}

/**
 * Token da reserva já gravada. Compara o sha256 do token do segredo atual e, se houver,
 * do anterior, com `accessTokenHash`. Devolve o que bate. Se nenhum bate, devolve o atual
 * e não o anterior. O hash gravado não muda. O aviso leva só o id da reserva.
 */
export function accessTokenForStoredHash(
  businessId: string,
  bookingId: string,
  accessTokenHash: string | null,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const current = signBookingAccessToken(businessId, bookingId, env);
  if (!current) return null;
  const previousSecret = bookingAccessSecretPrevious(env);
  const previous = previousSecret ? mac(previousSecret, bookingAccessTokenMessage(businessId, bookingId), "base64url") : null;
  const compared = previous ?? current;
  const currentOk = storedTokenHashMatches(current, accessTokenHash);
  const previousOk = storedTokenHashMatches(compared, accessTokenHash);
  if (currentOk) return current;
  if (previous && previousOk) return previous;
  console.warn(`O link de acompanhamento da reserva ${bookingId} não pode ser restaurado. Defina BOOKING_ACCESS_SECRET_PREVIOUS com o segredo de antes da rotação.`);
  return current;
}
