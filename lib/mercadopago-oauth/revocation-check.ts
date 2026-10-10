import { MP_USERS_ME_URL } from "./account-profile";
import type { MpFetch } from "./token-client";

export const MP_REVOCATION_CHECK_TIMEOUT_MS = 5000;

/** Códigos curtos de falha na confirmação. `token_unreadable` é local (cifra); os outros vêm da chamada. */
export const REVOCATION_LOG_CODES = ["timeout", "unreachable", "invalid_response", "token_unreadable"] as const;

export type RevocationUnavailableCode = Exclude<(typeof REVOCATION_LOG_CODES)[number], "token_unreadable"> | `http_${number}`;

const httpStatusCode = /^http_[1-5][0-9]{2}$/;

export function revocationLogCode(code: string) {
  if ((REVOCATION_LOG_CODES as readonly string[]).includes(code)) return code;
  if (httpStatusCode.test(code)) return code;
  return "invalid_response";
}

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
 * GET /users/me é o que o SDK oficial mercadopago faz em User.get
 * (src/clients/user/get/index.ts → RestClient.fetch('/users/me')).
 * A página de credenciais mostra o mesmo GET com Bearer:
 * https://www.mercadopago.com.br/developers/en/docs/your-integrations/credentials
 * HTTP 401 significa token inválido ou expirado.
 * `invalid_grant` está documentado só no POST /oauth/token:
 * https://www.mercadopago.com.br/developers/en/reference/authentication/oauth/_oauth_token/post
 * No GET /users/me, aceitar `invalid_grant` apenas com status 400 ou 401 é uma suposição defensiva.
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
    if (!response.ok) {
      // 401 revoga sem ler o corpo. `invalid_grant` no GET /users/me só conta com 400 ou 401:
      // o código está documentado no POST /oauth/token, então isto é uma suposição defensiva.
      if (response.status === 401) return { result: "revoked" };
      let payload: unknown;
      try { payload = await response.json(); }
      catch { return { result: "unavailable", code: httpCode(response.status) }; }
      if ((response.status === 400 || response.status === 401) && errorCode(payload) === "invalid_grant") return { result: "revoked" };
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
