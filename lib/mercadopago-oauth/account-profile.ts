import { z } from "zod";
import { maskEmail } from "../privacy/mask-email";
import type { MpFetch } from "./token-client";
import type { MpConnectionStore } from "./types";

/**
 * Host do SDK mercadopago@3.3.0.
 * dist/utils/config/index.js: AppConfig.BASE_URL = 'https://api.mercadopago.com'
 * dist/utils/restClient/index.js monta `${AppConfig.BASE_URL}${endpoint}`
 * dist/clients/user/get/index.js chama RestClient.fetch('/users/me') com Bearer do access token.
 */
export const MP_USERS_ME_URL = "https://api.mercadopago.com/users/me";
export const MP_ACCOUNT_PROFILE_TIMEOUT_MS = 5000;

const userMeSchema = z.object({
  nickname: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  email: z.string().nullish(),
});

export type AccountProfileFields = {
  accountDisplayName: string | null;
  accountEmailMasked: string | null;
};

export type AccountProfileFailure = "timeout" | "unreachable" | "invalid_response" | `http_${number}`;

function present(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/** "Ana S." com first_name e inicial do last_name. Sem first_name, o nickname. Sem os dois, null. */
export function accountDisplayName(profile: { first_name?: string | null; last_name?: string | null; nickname?: string | null }) {
  const first = present(profile.first_name);
  const last = present(profile.last_name);
  if (first) {
    const initial = last?.charAt(0);
    return initial ? `${first} ${initial}.` : first;
  }
  return present(profile.nickname);
}

/** Últimos 4 dígitos de mp_user_id. Menos de 4 dígitos não sai, para não revelar o id inteiro. */
export function accountIdLast4(mpUserId: string | null | undefined) {
  const digits = (mpUserId ?? "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function httpDetail(status: number): AccountProfileFailure {
  if (!Number.isInteger(status) || status < 100 || status > 599) return "invalid_response";
  return `http_${status}`;
}

/** Lê só nickname, first_name, last_name e email. Não devolve o payload nem o e-mail cru. */
export async function fetchAccountProfile(accessToken: string, fetchImpl: MpFetch = fetch, timeoutMs = MP_ACCOUNT_PROFILE_TIMEOUT_MS): Promise<{ ok: true } & AccountProfileFields | { ok: false; reason: AccountProfileFailure }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(MP_USERS_ME_URL, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: httpDetail(response.status) };
    let payload: unknown;
    try { payload = await response.json(); }
    catch { return { ok: false, reason: "invalid_response" }; }
    const parsed = userMeSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, reason: "invalid_response" };
    return {
      ok: true,
      accountDisplayName: accountDisplayName(parsed.data),
      accountEmailMasked: maskEmail(parsed.data.email),
    };
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return { ok: false, reason: aborted ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort. Falha zera os dois campos e grava só um código de erro, nunca o token nem o e-mail. */
export async function syncAccountProfile(input: {
  businessId: string;
  accessToken: string;
  store: MpConnectionStore;
  fetchImpl?: MpFetch;
  now: Date;
  timeoutMs?: number;
}) {
  const profile = await fetchAccountProfile(input.accessToken, input.fetchImpl, input.timeoutMs);
  if (!profile.ok) {
    await input.store.updateAccountProfile(input.businessId, { accountDisplayName: null, accountEmailMasked: null });
    await input.store.recordConnectionEvent({
      businessId: input.businessId,
      kind: "account_profile_failed",
      ip: null,
      detail: profile.reason,
      createdAt: input.now,
    });
    return;
  }
  await input.store.updateAccountProfile(input.businessId, {
    accountDisplayName: profile.accountDisplayName,
    accountEmailMasked: profile.accountEmailMasked,
  });
}
