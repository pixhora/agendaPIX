import { z } from "zod";
import { MP_TOKEN_TIMEOUT_MS, MP_TOKEN_URL } from "./config";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string().min(1).optional(),
  user_id: z.union([z.number().int(), z.string().min(1)]),
  refresh_token: z.string().min(1),
  public_key: z.string().min(1).optional(),
  live_mode: z.boolean().optional(),
}).passthrough();

export type MpTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string | null;
  mpUserId: string;
  publicKey: string | null;
  liveMode: boolean | null;
};

export type MpTokenFailure = "expired_code" | "invalid_grant" | "exchange_failed";

export type MpFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * POST /oauth/token em JSON, como o guia de OAuth.
 * O guia de Split usa application/x-www-form-urlencoded e também envia state: a doc não diz se os dois formatos são aceitos.
 * invalid_grant na troca do code vira expired_code: a doc agrupa code expirado, revogado e redirect_uri divergente nesse erro.
 */
export async function requestMpToken(body: Record<string, string>, fetchImpl: MpFetch = fetch): Promise<{ ok: true; tokens: MpTokenSet } | { ok: false; reason: MpTokenFailure }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MP_TOKEN_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(MP_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return { ok: false, reason: "exchange_failed" };
  } finally {
    clearTimeout(timer);
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { return { ok: false, reason: "exchange_failed" }; }
  const errorCode = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : null;
  if (!response.ok) {
    if (errorCode === "invalid_grant") return { ok: false, reason: body.grant_type === "refresh_token" ? "invalid_grant" : "expired_code" };
    return { ok: false, reason: "exchange_failed" };
  }
  const parsed = tokenResponseSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: "exchange_failed" };
  return {
    ok: true,
    tokens: {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresIn: parsed.data.expires_in,
      scope: parsed.data.scope ?? null,
      mpUserId: String(parsed.data.user_id),
      publicKey: parsed.data.public_key ?? null,
      liveMode: parsed.data.live_mode ?? null,
    },
  };
}
