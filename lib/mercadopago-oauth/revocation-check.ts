import { MP_USERS_ME_URL } from "./account-profile";
import type { MpFetch } from "./token-client";

export const MP_REVOCATION_CHECK_TIMEOUT_MS = 5000;

export type RevocationUnavailableCode = "timeout" | "unreachable" | "invalid_response" | `http_${number}`;

export type RevocationCheck =
  | { result: "revoked" }
  | { result: "active" }
  | { result: "unavailable"; code: RevocationUnavailableCode };

function httpCode(status: number): RevocationUnavailableCode {
  if (!Number.isInteger(status) || status < 100 || status > 599) return "invalid_response";
  return `http_${status}`;
}

function errorCode(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}

/**
 * Confirma se o access token do vendedor ainda vale, sem rotacionar o refresh.
 * GET /users/me: 401 significa token inválido ou expirado.
 * https://www.mercadopago.com.br/developers/pt/reference/users/_users_me/get
 * `invalid_grant` é o erro documentado quando o grant foi revogado.
 * https://www.mercadopago.com.br/developers/en/reference/authentication/oauth/_oauth_token/post
 * Não chama POST /oauth/token: o refresh token é de uso único.
 * https://www.mercadopago.com.br/developers/en/docs/security/oauth/renewal
 */
export async function checkAccessTokenRevoked(accessToken: string, fetchImpl: MpFetch = fetch, timeoutMs = MP_REVOCATION_CHECK_TIMEOUT_MS): Promise<RevocationCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(MP_USERS_ME_URL, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 401) return { result: "revoked" };
    if (!response.ok) {
      let payload: unknown;
      try { payload = await response.json(); }
      catch { return { result: "unavailable", code: httpCode(response.status) }; }
      if (errorCode(payload) === "invalid_grant") return { result: "revoked" };
      return { result: "unavailable", code: httpCode(response.status) };
    }
    return { result: "active" };
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return { result: "unavailable", code: aborted ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
