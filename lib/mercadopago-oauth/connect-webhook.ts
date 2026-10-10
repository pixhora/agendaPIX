import { createHmac } from "node:crypto";
import { z } from "zod";
import { invalidatePublicCatalogForBusiness } from "../bookings/public-cache";
import { HttpError } from "../http";
import { MERCADOPAGO_WEBHOOK_FRESHNESS_MS, mercadoPagoTimestampMs } from "../payments/mercadopago";
import { webhookSecret, mpOAuthConfig } from "./config";
import { decryptMpToken } from "./crypto";
import { createDrizzleMpStore } from "./repository";
import { checkAccessTokenRevoked, revocationLogCode } from "./revocation-check";
import { safeEqualHex } from "./timing";
import type { MpConnectionStore } from "./types";
import type { MpFetch } from "./token-client";
import { createDrizzleWebhookEvents, mpConnectRequestId, type WebhookEventPort } from "./webhook-events";

const notificationSchema = z.object({
  action: z.string().min(1),
  type: z.literal("mp-connect"),
  user_id: z.union([z.number().int(), z.string().min(1)]),
}).passthrough();

/**
 * Manifesto documentado: id:[data.id da query];request-id:[x-request-id];ts:[ts];
 * Valores ausentes saem do manifesto. data.id alfanumérico vai em minúsculas.
 * A doc do x-signature permite comparar o `ts` com o relógio de recebimento para
 * estabelecer uma tolerância, mas não fixa o número de minutos:
 * https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
 * A janela é a mesma do webhook de pagamento (`MERCADOPAGO_WEBHOOK_FRESHNESS_MS`, ±5 min).
 */
export function mercadoPagoManifest(parts: { dataId?: string | null; requestId?: string | null; ts: string }) {
  const chunks: string[] = [];
  if (parts.dataId) chunks.push(`id:${parts.dataId.toLowerCase()}`);
  if (parts.requestId) chunks.push(`request-id:${parts.requestId}`);
  chunks.push(`ts:${parts.ts}`);
  return `${chunks.join(";")};`;
}

function parseSignature(header: string) {
  const map = new Map<string, string>();
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    map.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  const ts = map.get("ts");
  const v1 = map.get("v1");
  if (!ts || !/^\d+$/.test(ts) || !v1 || !/^[a-f0-9]+$/i.test(v1)) return null;
  return { ts, v1 };
}

export function assertMpWebhookSignature(input: { url: string; headers: Headers; secret: string; now?: Date }) {
  const parsed = parseSignature(input.headers.get("x-signature") ?? "");
  if (!parsed) throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
  let dataId: string | null = null;
  try { dataId = new URL(input.url).searchParams.get("data.id"); }
  catch { dataId = null; }
  const manifest = mercadoPagoManifest({ dataId, requestId: input.headers.get("x-request-id"), ts: parsed.ts });
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  if (!safeEqualHex(parsed.v1, expected)) throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
  const now = input.now ?? new Date();
  const tsMs = mercadoPagoTimestampMs(parsed.ts);
  if (tsMs === null || Math.abs(now.getTime() - tsMs) > MERCADOPAGO_WEBHOOK_FRESHNESS_MS) {
    throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
  }
}

function revocationUnconfirmed() {
  return new HttpError(503, "mp_revocation_unconfirmed", "Não foi possível confirmar o desligamento no Mercado Pago. A conexão continua ativa.");
}

function logRevocationUnconfirmed(code: string) {
  console.error(`[mp-connect] revocation_unconfirmed code=${revocationLogCode(code)}`);
}

export async function handleMpConnectWebhook(input: {
  body: string;
  headers: Headers;
  url: string;
  env?: Readonly<Record<string, string | undefined>>;
  store?: MpConnectionStore;
  now?: Date;
  fetchImpl?: MpFetch;
  events?: WebhookEventPort;
  revocationTimeoutMs?: number;
}) {
  assertMpWebhookSignature({ url: input.url, headers: input.headers, secret: webhookSecret(input.env), now: input.now });
  let payload: unknown;
  try { payload = JSON.parse(input.body); }
  catch { throw new HttpError(400, "invalid_event", "Evento inválido."); }
  const parsed = notificationSchema.safeParse(payload);
  if (!parsed.success) throw new HttpError(400, "invalid_event", "Evento inválido.");
  const requestId = mpConnectRequestId(input.headers.get("x-request-id"));
  if (!requestId) throw new HttpError(400, "invalid_event", "Evento inválido.");
  const events = input.events ?? createDrizzleWebhookEvents();
  const mpUserId = String(parsed.data.user_id);
  if (parsed.data.action !== "application.deauthorized") {
    const recorded = await events.record(requestId);
    if (recorded === "duplicate") return { outcome: "duplicate" as const };
    // application.authorized não traz tokens. A vinculação válida continua sendo a troca do code.
    if (parsed.data.action === "application.authorized") return { outcome: "ignored" as const, reason: "authorized_without_token_exchange" };
    return { outcome: "ignored" as const, reason: "unsupported_action" };
  }
  // Antes do GET /users/me: entrega já vista não consulta o Mercado Pago nem desconecta.
  if (await events.seen(requestId)) return { outcome: "duplicate" as const };

  const store = input.store ?? createDrizzleMpStore();
  const connection = await store.findByMpUserId(mpUserId);
  if (!connection?.accessTokenEnc) {
    const recorded = await events.record(requestId);
    if (recorded === "duplicate") return { outcome: "duplicate" as const };
    return { outcome: "ignored" as const, reason: "no_token" };
  }

  let accessToken: string;
  try {
    accessToken = decryptMpToken(connection.accessTokenEnc, connection.businessId, "access", mpOAuthConfig(input.env).encryptionKey);
  } catch {
    logRevocationUnconfirmed("token_unreadable");
    throw revocationUnconfirmed();
  }
  const verdict = await checkAccessTokenRevoked(accessToken, input.fetchImpl, input.revocationTimeoutMs);
  if (verdict.result === "unavailable") {
    logRevocationUnconfirmed(verdict.code);
    throw revocationUnconfirmed();
  }
  if (verdict.result === "active") {
    const recorded = await events.record(requestId);
    if (recorded === "duplicate") return { outcome: "duplicate" as const };
    return { outcome: "ignored" as const, reason: "authorization_still_active" };
  }

  const claimed = await events.deauthorize(requestId, mpUserId);
  if (claimed.kind === "duplicate") return { outcome: "duplicate" as const };
  for (const businessId of claimed.businessIds) await invalidatePublicCatalogForBusiness(businessId);
  return { outcome: "deauthorized" as const };
}
