import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { HttpError } from "../http";
import {
  chargeInputSchema,
  IgnoredWebhookEvent,
  paidEventSchema,
  type ChargeInput,
  type PaymentProvider,
  type PixCharge,
  type ProviderCallOptions,
  type ProviderCharge,
} from "./provider";

/** Mesma URL para sandbox e produção; o access token (teste vs prod) define o ambiente. */
export const MERCADOPAGO_BASE_URL = "https://api.mercadopago.com";
export type MercadoPagoEnv = "sandbox" | "production";
export type MercadoPagoFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Pix no Orders API (Checkout Transparente) suporta expirações a partir de 30 minutos.
 * O hold local (BOOKING_HOLD_MINUTES, tipicamente 10) continua mais curto: pagamento após o hold
 * deve seguir o fluxo de pagamento atrasado / estorno.
 */
export const MERCADOPAGO_PIX_MIN_EXPIRATION_MS = 30 * 60 * 1000;

export type MercadoPagoPaymentProviderOptions = {
  accessToken: string;
  webhookSecret: string;
  /** sandbox | production — só documenta o tipo de credencial; a API é a mesma. */
  env?: MercadoPagoEnv;
  baseUrl?: string;
  fetchImpl?: MercadoPagoFetch;
  now?: () => Date;
};

/**
 * Orders API: resposta de POST /v1/orders ou GET /v1/orders/{id}.
 * O pagamento Pix fica em transactions.payments[0], com qr_code/qr_code_base64 dentro de payment_method.
 */
const orderSchema = z.object({
  id: z.string().min(1), // "ORDTST01..." ou "ORD01..." em prod
  status: z.string().min(1), // "action_required" enquanto aguarda pagamento
  external_reference: z.string().optional().nullable(),
  total_amount: z.string().min(1), // string decimal, ex.: "10.00"
  date_created: z.string().optional().nullable(),
  date_closed: z.string().optional().nullable(), // data de conclusão (pago ou cancelado)
  transactions: z.object({
    payments: z.array(z.object({
      id: z.string().min(1), // "PAY01..." - id do pagamento nested
      status: z.string().min(1), // "pending" | "approved" | "rejected" | "cancelled"
      status_detail: z.string().optional().nullable(),
      amount: z.string().min(1), // string decimal
      date_approved: z.string().optional().nullable(),
      date_created: z.string().optional().nullable(),
      payment_method: z.object({
        id: z.string().min(1), // "pix"
        type: z.string().min(1), // "bank_transfer"
        qr_code: z.string().optional().nullable(), // EMV do Pix
        qr_code_base64: z.string().optional().nullable(), // QR PNG base64
        ticket_url: z.string().optional().nullable(), // URL com QR (alternativa)
      }).passthrough(),
    }).passthrough()),
  }).passthrough(),
}).passthrough();
type MpOrder = z.infer<typeof orderSchema>;

const webhookBodySchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).passthrough().optional(),
}).passthrough();

class MercadoPagoHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "MercadoPagoHttpError";
  }
}

function isNotFound(error: unknown) {
  return error instanceof MercadoPagoHttpError && error.status === 404;
}

function constantTimeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/** Formato exigido pela API: yyyy-MM-dd'T'HH:mm:ss.SSSz */
export function formatMercadoPagoDate(date: Date) {
  return date.toISOString().replace(/Z$/, "-00:00");
}

export function centsToTransactionAmount(amountCents: number) {
  return Number((amountCents / 100).toFixed(2));
}

/**
 * Manifesto oficial do webhook MP:
 * id:{data.id};request-id:{x-request-id};ts:{ts};
 * (omite pares ausentes; data.id alfanumérico em minúsculas).
 */
export function buildMercadoPagoManifest(parts: { dataId?: string | null; requestId?: string | null; ts: string }) {
  const chunks: string[] = [];
  if (parts.dataId) chunks.push(`id:${parts.dataId.toLowerCase()}`);
  if (parts.requestId) chunks.push(`request-id:${parts.requestId}`);
  chunks.push(`ts:${parts.ts}`);
  return `${chunks.join(";")};`;
}

export function signMercadoPagoWebhook(manifest: string, secret: string) {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

function parseXSignature(header: string) {
  const map = new Map<string, string>();
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    map.set(part.slice(0, idx).trim(), part.slice(idx + 1).trim());
  }
  const ts = map.get("ts");
  const v1 = map.get("v1");
  if (!ts || !v1) return null;
  return { ts, v1 };
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "Cliente", lastName: parts.slice(1).join(" ") || parts[0] || "Cliente" };
}

function payerEmail(customer: { email?: string; cpfCnpj: string }) {
  return customer.email ?? `cpf${customer.cpfCnpj}@pagador.agendapix.invalid`;
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = "mercadopago";
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: MercadoPagoFetch;
  private readonly now: () => Date;
  /**
   * Cache em memória reference → orderId para idempotência.
   * Orders API não possui endpoint /search por external_reference.
   * Em produção com múltiplas instâncias, mover para Redis ou tabela payments com index em reference.
   */
  private readonly referenceCache = new Map<string, string>();

  constructor(options: MercadoPagoPaymentProviderOptions) {
    this.accessToken = z.string().min(1).refine((value) => !value.startsWith("replace-this-")).parse(options.accessToken);
    this.webhookSecret = z.string().min(16).refine((value) => !value.startsWith("replace-this-")).parse(options.webhookSecret);
    this.baseUrl = z.url().parse(options.baseUrl ?? MERCADOPAGO_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? (() => new Date());
  }

  private async request(path: string, init: { method: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal }) {
    if (init.signal?.aborted) throw init.signal.reason ?? new Error("Aborted");
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new MercadoPagoHttpError(response.status, `Mercado Pago ${init.method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) as unknown : {};
  }

  private async view(order: MpOrder): Promise<ProviderCharge> {
    const now = this.now();
    // Orders API não retorna date_of_expiration explícita; expiramos localmente se pendente há mais de 30 min + buffer
    const createdAt = order.date_created ? new Date(order.date_created) : now;
    const expiresAt = new Date(createdAt.getTime() + MERCADOPAGO_PIX_MIN_EXPIRATION_MS);
    
    const payment = order.transactions.payments[0];
    if (!payment) throw new Error(`Order ${order.id} sem payment nested.`);
    
    const copyPaste = payment.payment_method.qr_code ?? `MP:${order.id}`;
    const amountCents = Math.round(Number(order.total_amount) * 100);
    
    let status: ProviderCharge["status"];
    // Orders API: order.status "processed" + status_detail "accredited" = pago
    // Payment.status também pode ser "approved" ou "accredited"
    const isPaid = 
      order.status === "processed" || 
      payment.status === "approved" || 
      payment.status === "accredited";
    
    if (isPaid) status = "paid";
    else if (payment.status === "canceled" || payment.status === "rejected" || order.status === "canceled") status = "cancelled";
    else if (expiresAt <= now) status = "expired";
    else status = "pending";
    
    const paidAt = status === "paid"
      ? new Date(payment.date_approved ?? payment.date_created ?? now.toISOString())
      : null;
    
    return {
      externalId: order.id, // usamos order.id como externalId principal
      reference: order.external_reference ?? null,
      amountCents,
      expiresAt,
      qrCodeDataUrl: await QRCode.toDataURL(copyPaste, { width: 256, margin: 2 }),
      copyPaste,
      status,
      paidAt,
    };
  }

  private toPix(charge: ProviderCharge): PixCharge {
    return {
      externalId: charge.externalId,
      amountCents: charge.amountCents,
      expiresAt: charge.expiresAt,
      qrCodeDataUrl: charge.qrCodeDataUrl,
      copyPaste: charge.copyPaste,
    };
  }

  async createPixCharge(input: ChargeInput, options: ProviderCallOptions = {}): Promise<PixCharge> {
    const data = chargeInputSchema.parse(input);
    // Lookup ANTES de criar: retries/reconciliador sem CPF recuperam a cobrança já emitida.
    const existing = await this.findChargeByReference(data.reference, options);
    if (existing) {
      if (existing.amountCents !== data.amountCents) throw new Error("Chave de idempotência reutilizada com outros dados.");
      return this.toPix(existing);
    }
    const names = data.customer ? splitName(data.customer.name) : { firstName: "Cliente", lastName: "AgendaPIX" };
    try {
      const created = orderSchema.parse(await this.request("/v1/orders", {
        method: "POST",
        signal: options.signal,
        // X-Idempotency-Key = order.id (reference); nativo do MP evita duplicar na reexecução.
        headers: { "X-Idempotency-Key": data.reference },
        body: {
          type: "online",
          external_reference: data.reference,
          total_amount: centsToTransactionAmount(data.amountCents).toFixed(2),
          processing_mode: "automatic",
          transactions: {
            payments: [{
              amount: centsToTransactionAmount(data.amountCents).toFixed(2),
              payment_method: { id: "pix", type: "bank_transfer" },
            }],
          },
          payer: {
            email: data.customer ? payerEmail(data.customer) : `hold-${data.reference}@pagador.agendapix.invalid`,
            ...(data.customer ? {
              first_name: names.firstName,
              last_name: names.lastName,
              identification: { type: "CPF", number: data.customer.cpfCnpj },
            } : {}),
          },
          // Orders API pode suportar date_of_expiration no futuro; por ora não documentado
        },
      }));
      // Cache reference → orderId para idempotência futura (normalizado para lowercase)
      this.referenceCache.set(data.reference, created.id.toLowerCase());
      return this.toPix(await this.view(created));
    } catch (error) {
      if (error instanceof MercadoPagoHttpError && error.status < 500) {
        const raced = await this.findChargeByReference(data.reference, options);
        if (raced && raced.amountCents === data.amountCents) return this.toPix(raced);
      }
      throw error;
    }
  }

  async getCharge(externalId: string, options: ProviderCallOptions = {}) {
    try {
      const found = orderSchema.parse(await this.request(`/v1/orders/${encodeURIComponent(externalId)}`, { method: "GET", signal: options.signal }));
      return this.view(found);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async findChargeByReference(reference: string, options: ProviderCallOptions = {}) {
    // Orders API não tem /search por external_reference; usamos cache local
    const orderId = this.referenceCache.get(reference);
    if (!orderId) {
      // TODO: em produção, consultar DB local que mapeia reference → orderId
      return null;
    }
    return this.getCharge(orderId, options);
  }

  async cancelCharge(externalId: string, options: ProviderCallOptions = {}) {
    const current = await this.getCharge(externalId, options);
    if (!current) return null;
    if (current.status === "paid") return current;
    try {
      // Orders API: cancelamento via POST /v1/orders/{id}/cancel (sem body)
      // Status final: "canceled" (um L)
      const updated = orderSchema.parse(await this.request(`/v1/orders/${encodeURIComponent(externalId)}/cancel`, {
        method: "POST",
        signal: options.signal,
      }));
      return this.view(updated);
    } catch (error) {
      const after = await this.getCharge(externalId, options);
      if (after?.status === "paid") return after;
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async verifyWebhook(body: string, headers: Headers, now: Date, requestUrl?: string) {
    const invalid = () => new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
    const parsedSig = parseXSignature(headers.get("x-signature") ?? "");
    if (!parsedSig) throw invalid();

    let dataId: string | undefined;
    if (requestUrl) {
      try {
        const fromQuery = new URL(requestUrl).searchParams.get("data.id");
        if (fromQuery) dataId = fromQuery;
      } catch { /* ignore malformed url */ }
    }
    const payload = webhookBodySchema.parse(JSON.parse(body));
    if (!dataId && payload.data?.id != null) dataId = String(payload.data.id);

    const manifest = buildMercadoPagoManifest({
      dataId,
      requestId: headers.get("x-request-id"),
      ts: parsedSig.ts,
    });
    if (!constantTimeEqualHex(parsedSig.v1, signMercadoPagoWebhook(manifest, this.webhookSecret))) throw invalid();

    // Orders API: tipo pode ser "order" ou "payment" (nested); precisamos consultar o order
    // Hipótese: webhook traz data.id do order (ORDTST...) ou do payment (PAY...)
    // Se for payment, precisamos do order; se for order, consultamos direto
    if (payload.type && payload.type !== "payment" && payload.type !== "order") throw new IgnoredWebhookEvent(payload.type);
    if (!dataId) throw new z.ZodError([]);

    // Normaliza order ID para lowercase antes de lookup (case-insensitive)
    const normalizedId = dataId.toLowerCase();
    const order = await this.getCharge(normalizedId);
    if (!order) {
      // Se não achou com lowercase, tenta original
      const orderOriginal = await this.getCharge(dataId);
      if (!orderOriginal) {
        // Se não achou, dataId pode ser paymentId; Orders API não tem lookup por paymentId
        throw new HttpError(404, "order_not_found", "Pedido não encontrado.");
      }
      if (orderOriginal.status !== "paid") {
        throw new IgnoredWebhookEvent(payload.action ?? orderOriginal.status);
      }
      const notificationId = payload.id != null ? String(payload.id) : `order:${orderOriginal.externalId}`;
      return paidEventSchema.parse({
        eventId: `mp:${notificationId}`,
        type: "payment.paid",
        externalId: orderOriginal.externalId,
        amountCents: orderOriginal.amountCents,
        paidAt: (orderOriginal.paidAt ?? now).toISOString(),
      });
    }
    if (order.status !== "paid") {
      throw new IgnoredWebhookEvent(payload.action ?? order.status);
    }
    const notificationId = payload.id != null ? String(payload.id) : `order:${order.externalId}`;
    return paidEventSchema.parse({
      eventId: `mp:${notificationId}`,
      type: "payment.paid",
      externalId: order.externalId,
      amountCents: order.amountCents,
      paidAt: (order.paidAt ?? now).toISOString(),
    });
  }
}
