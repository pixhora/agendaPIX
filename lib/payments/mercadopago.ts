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
 * Pix no Checkout API exige date_of_expiration entre 30 minutos e 30 dias.
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

const paymentSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  status: z.string().min(1),
  status_detail: z.string().optional().nullable(),
  transaction_amount: z.number().positive(),
  external_reference: z.string().optional().nullable(),
  date_of_expiration: z.string().optional().nullable(),
  date_approved: z.string().optional().nullable(),
  date_created: z.string().optional().nullable(),
  point_of_interaction: z.object({
    transaction_data: z.object({
      qr_code: z.string().optional().nullable(),
      qr_code_base64: z.string().optional().nullable(),
    }).passthrough().optional().nullable(),
  }).passthrough().optional().nullable(),
}).passthrough();
type MpPayment = z.infer<typeof paymentSchema>;

const searchSchema = z.object({
  results: z.array(paymentSchema).default([]),
}).passthrough();

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

export function transactionAmountToCents(amount: number) {
  return Math.round(amount * 100);
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

  private async view(payment: MpPayment): Promise<ProviderCharge> {
    const now = this.now();
    const expiresAt = payment.date_of_expiration ? new Date(payment.date_of_expiration) : now;
    const copyPaste = payment.point_of_interaction?.transaction_data?.qr_code
      ?? `MP:${payment.id}`;
    const amountCents = transactionAmountToCents(payment.transaction_amount);
    let status: ProviderCharge["status"];
    if (payment.status === "approved") status = "paid";
    else if (payment.status === "cancelled" || payment.status === "rejected" || payment.status === "refunded" || payment.status === "charged_back") status = "cancelled";
    else if (expiresAt <= now) status = "expired";
    else status = "pending";
    const paidAt = status === "paid"
      ? new Date(payment.date_approved ?? payment.date_created ?? now.toISOString())
      : null;
    return {
      externalId: String(payment.id),
      reference: payment.external_reference ?? null,
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
    const now = this.now();
    const minExpiry = new Date(now.getTime() + MERCADOPAGO_PIX_MIN_EXPIRATION_MS);
    const dateOfExpiration = data.expiresAt > minExpiry ? data.expiresAt : minExpiry;
    const names = data.customer ? splitName(data.customer.name) : { firstName: "Cliente", lastName: "AgendaPIX" };
    try {
      const created = paymentSchema.parse(await this.request("/v1/payments", {
        method: "POST",
        signal: options.signal,
        // X-Idempotency-Key = payment.id (reference); nativo do MP evita duplicar na reexecução.
        headers: { "X-Idempotency-Key": data.reference },
        body: {
          transaction_amount: centsToTransactionAmount(data.amountCents),
          description: "Sinal de agendamento",
          payment_method_id: "pix",
          external_reference: data.reference,
          date_of_expiration: formatMercadoPagoDate(dateOfExpiration),
          payer: {
            email: data.customer ? payerEmail(data.customer) : `hold-${data.reference}@pagador.agendapix.invalid`,
            first_name: names.firstName,
            last_name: names.lastName,
            ...(data.customer ? {
              identification: { type: "CPF", number: data.customer.cpfCnpj },
            } : {}),
          },
        },
      }));
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
      const found = paymentSchema.parse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}`, { method: "GET", signal: options.signal }));
      return this.view(found);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async findChargeByReference(reference: string, options: ProviderCallOptions = {}) {
    const found = searchSchema.parse(await this.request(
      `/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc`,
      { method: "GET", signal: options.signal },
    ));
    const match = found.results.find((item) => item.external_reference === reference) ?? found.results[0];
    return match ? this.view(match) : null;
  }

  async cancelCharge(externalId: string, options: ProviderCallOptions = {}) {
    const current = await this.getCharge(externalId, options);
    if (!current) return null;
    if (current.status === "paid") return current;
    try {
      const updated = paymentSchema.parse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}`, {
        method: "PUT",
        signal: options.signal,
        body: { status: "cancelled" },
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

    // Só notificações de payment com id; demais tipos (merchant_order, teste) → ignored.
    if (payload.type && payload.type !== "payment") throw new IgnoredWebhookEvent(payload.type);
    if (!dataId) throw new z.ZodError([]);

    const payment = await this.getCharge(dataId);
    if (!payment) throw new HttpError(404, "payment_not_found", "Pagamento não encontrado.");
    if (payment.status !== "paid") {
      throw new IgnoredWebhookEvent(payload.action ?? payment.status);
    }
    const notificationId = payload.id != null ? String(payload.id) : `payment:${payment.externalId}`;
    return paidEventSchema.parse({
      eventId: `mp:${notificationId}`,
      type: "payment.paid",
      externalId: payment.externalId,
      amountCents: payment.amountCents,
      paidAt: (payment.paidAt ?? now).toISOString(),
    });
  }
}
