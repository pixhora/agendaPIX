import { createHmac } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../http";
import { webhookSecret } from "./config";
import { createDrizzleMpStore } from "./repository";
import { safeEqualHex } from "./timing";
import type { MpConnectionStore } from "./types";

const notificationSchema = z.object({
  action: z.string().min(1),
  type: z.literal("mp-connect"),
  user_id: z.union([z.number().int(), z.string().min(1)]),
}).passthrough();

/**
 * Manifesto documentado: id:[data.id da query];request-id:[x-request-id];ts:[ts];
 * Valores ausentes saem do manifesto. data.id alfanumérico vai em minúsculas.
 * A janela de tolerância do ts não está documentada: a assinatura HMAC é obrigatória, a idade do ts não rejeita a entrega.
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

export function assertMpWebhookSignature(input: { url: string; headers: Headers; secret: string }) {
  const parsed = parseSignature(input.headers.get("x-signature") ?? "");
  if (!parsed) throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
  let dataId: string | null = null;
  try { dataId = new URL(input.url).searchParams.get("data.id"); }
  catch { dataId = null; }
  const manifest = mercadoPagoManifest({ dataId, requestId: input.headers.get("x-request-id"), ts: parsed.ts });
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  if (!safeEqualHex(parsed.v1, expected)) throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
}

export async function handleMpConnectWebhook(input: {
  body: string;
  headers: Headers;
  url: string;
  env?: Readonly<Record<string, string | undefined>>;
  store?: MpConnectionStore;
}) {
  assertMpWebhookSignature({ url: input.url, headers: input.headers, secret: webhookSecret(input.env) });
  let payload: unknown;
  try { payload = JSON.parse(input.body); }
  catch { throw new HttpError(400, "invalid_event", "Evento inválido."); }
  const parsed = notificationSchema.safeParse(payload);
  if (!parsed.success) throw new HttpError(400, "invalid_event", "Evento inválido.");
  const mpUserId = String(parsed.data.user_id);
  if (parsed.data.action === "application.deauthorized") {
    await (input.store ?? createDrizzleMpStore()).markDeauthorized(mpUserId);
    return { outcome: "deauthorized" as const };
  }
  // application.authorized não traz tokens. A vinculação válida continua sendo a troca do code.
  if (parsed.data.action === "application.authorized") return { outcome: "ignored" as const, reason: "authorized_without_token_exchange" };
  return { outcome: "ignored" as const, reason: "unsupported_action" };
}
