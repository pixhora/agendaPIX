import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { PIX_EXPIRATION_MARGIN_MINUTES, PIX_EXPIRATION_MIN_MINUTES } from "../bookings/config";
import { payerCpfRequired } from "../marketing/facts";
import { HttpError } from "../http";
import { paymentsConfig } from "./config";
import { callProvider } from "./timeout";
import { MpAccountNotConnectedError, resolveMpAccessToken, type MpAccessTokenQuery } from "./seller-account";
import {
  chargeInputSchema,
  IgnoredWebhookEvent,
  ObservedRefundEvent,
  UnverifiableSellerPayment,
  paidEventSchema,
  type ChargeInput,
  type PaymentProvider,
  type PixCharge,
  type ProviderCallOptions,
  type ProviderCharge,
  type RefundResult,
} from "./provider";
import { InMemoryChargeReferenceStore, type ChargeReferenceStore } from "./reference-store";
import {
  causeCodesFromMpBody,
  classifyPixCreateRefusal,
  isDefinitivePixRefusal,
  logPixCreateFailure,
  PixCreateRefusedError,
  safeMpRequestId,
} from "./pix-create-log";

/** Mesma URL para sandbox e produção; o access token (teste vs prod) define o ambiente. */
export const MERCADOPAGO_BASE_URL = "https://api.mercadopago.com";
export type MercadoPagoEnv = "sandbox" | "production";
export type MercadoPagoFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Janela de frescor do `ts` do webhook (milissegundos), além do HMAC.
 * A doc pede comparar o timestamp da notificação com o relógio local.
 * https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
 */
export const MERCADOPAGO_WEBHOOK_FRESHNESS_MS = 5 * 60 * 1000;

/**
 * A Payments API aceita `date_of_expiration` de 30 minutos a 30 dias e não diz se
 * exatamente 30 minutos passa. Somamos esta margem ao hold para o pedido não nascer
 * no limite. O hold da reserva (e o `expiresAt` público) continua sendo só
 * `BOOKING_HOLD_MINUTES`; pagamento depois disso cai no fluxo atrasado.
 */
export const MERCADOPAGO_PIX_EXPIRATION_MARGIN_MINUTES = PIX_EXPIRATION_MARGIN_MINUTES;
export const MERCADOPAGO_PIX_MIN_EXPIRATION_MS = PIX_EXPIRATION_MIN_MINUTES * 60_000;

const NO_CONFIRM_DETAILS = new Set(["refunded", "partially_refunded", "charged_back"]);

export type { MpAccessTokenQuery };
export { resolveMpAccessToken };
export type ResolveMpAccessToken = (query: MpAccessTokenQuery) => Promise<string>;

export type MercadoPagoPaymentProviderOptions = {
  /** Token da plataforma. Usado quando não há `resolveAccessToken`. */
  accessToken: string;
  webhookSecret: string;
  /** sandbox | production — só documenta o tipo de credencial; a API é a mesma. */
  env?: MercadoPagoEnv;
  baseUrl?: string;
  /** URL pública do webhook `payment`. Sem isto, usa `MERCADOPAGO_NOTIFICATION_URL` ou `BETTER_AUTH_URL`. */
  notificationUrl?: string;
  fetchImpl?: MercadoPagoFetch;
  now?: () => Date;
  /**
   * Resolve o token de cada chamada. Ausente: usa o `accessToken` do construtor.
   * `getPaymentProvider` injeta `resolveMpAccessToken`.
   */
  resolveAccessToken?: ResolveMpAccessToken;
  /**
   * reference (id do pagamento local) → id no Mercado Pago.
   * A busca `GET /v1/payments/search` existe, mas o store sobrevive entre instâncias
   * mesmo quando a busca falha. Produção usa `DatabaseChargeReferenceStore`.
   */
  referenceStore?: ChargeReferenceStore;
};

const paymentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  status: z.string().min(1),
  status_detail: z.string().nullable().optional(),
  external_reference: z.string().nullable().optional(),
  transaction_amount: z.coerce.number(),
  date_of_expiration: z.string().nullable().optional(),
  date_approved: z.string().nullable().optional(),
  date_created: z.string().nullable().optional(),
  collector_id: z.union([z.string(), z.number()]).nullable().optional(),
  point_of_interaction: z.object({
    transaction_data: z.object({
      qr_code: z.string().nullable().optional(),
      qr_code_base64: z.string().nullable().optional(),
      ticket_url: z.string().nullable().optional(),
    }).passthrough().nullable().optional(),
  }).passthrough().nullable().optional(),
}).passthrough();
type MpPayment = z.infer<typeof paymentSchema>;

const searchSchema = z.object({
  results: z.array(paymentSchema).optional(),
}).passthrough();

const refundSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  payment_id: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const webhookBodySchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
  action: z.string().optional(),
  user_id: z.union([z.number(), z.string()]).nullable().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).passthrough().optional(),
}).passthrough();

class MercadoPagoHttpError extends Error {
  readonly causeCodes: readonly string[];
  readonly requestId: string | null;

  constructor(readonly status: number, message: string, causeCodes: readonly string[] = [], requestId: string | null = null) {
    super(message);
    this.name = "MercadoPagoHttpError";
    this.causeCodes = causeCodes;
    this.requestId = requestId;
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

/**
 * `date_approved` do GET /v1/payments/{id}: string ISO-8601 (ex.: `2017-08-31T11:26:38.000Z`).
 * Ausente ou inválido não vira data. Não usa `date_created`.
 * https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/get-payment/get
 */
export function parseApprovalInstant(value: string | null | undefined): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function knownApproval(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** ISO-8601 com offset (`-00:00`), como a Payments API descreve `date_of_expiration`. */
export function formatMercadoPagoDate(date: Date) {
  return date.toISOString().replace(/Z$/, "-00:00");
}

/** `date_of_expiration` enviado ao Mercado Pago: fim do hold + margem de 2 minutos. */
export function pixDateOfExpiration(holdExpiresAt: Date) {
  return formatMercadoPagoDate(new Date(holdExpiresAt.getTime() + MERCADOPAGO_PIX_EXPIRATION_MARGIN_MINUTES * 60_000));
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

/** Domínio do e-mail sintético. No DNS: `MX 0 .` (null MX, RFC 7505). */
export const SYNTHETIC_PAYER_EMAIL_DOMAIN = "pagador.agendapix.dev.br";

/** Sem e-mail real, a parte local é só `hold-<reference>`. Sem nome, telefone ou CPF. */
function payerEmail(customer: { email?: string } | undefined, reference: string) {
  if (customer?.email) return customer.email;
  return `hold-${reference}@${SYNTHETIC_PAYER_EMAIL_DOMAIN}`;
}

/**
 * `ts` do x-signature. Exemplos novos usam milissegundos (13 dígitos). Exemplos antigos
 * usam 10 dígitos; esses entram como segundos. A janela é ±300s.
 */
export function mercadoPagoTimestampMs(ts: string) {
  if (!/^\d+$/.test(ts)) return null;
  const value = Number(ts);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function isNoConfirm(payment: MpPayment) {
  const status = payment.status.toLowerCase();
  const detail = (payment.status_detail ?? "").toLowerCase();
  return NO_CONFIRM_DETAILS.has(status) || NO_CONFIRM_DETAILS.has(detail);
}

function isAccredited(payment: MpPayment) {
  return payment.status === "approved" && payment.status_detail === "accredited" && !isNoConfirm(payment);
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = "mercadopago";
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;
  private readonly notificationUrl: string | undefined;
  private readonly fetchImpl: MercadoPagoFetch;
  private readonly now: () => Date;
  private readonly resolveAccessToken: ResolveMpAccessToken;
  private readonly referenceStore: ChargeReferenceStore;

  constructor(options: MercadoPagoPaymentProviderOptions) {
    this.accessToken = z.string().min(1).refine((value) => !value.startsWith("replace-this-")).parse(options.accessToken);
    this.webhookSecret = z.string().min(16).refine((value) => !value.startsWith("replace-this-")).parse(options.webhookSecret);
    this.baseUrl = z.url().parse(options.baseUrl ?? MERCADOPAGO_BASE_URL).replace(/\/+$/, "");
    this.notificationUrl = options.notificationUrl;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? (() => new Date());
    this.resolveAccessToken = options.resolveAccessToken ?? (async () => this.accessToken);
    this.referenceStore = options.referenceStore ?? new InMemoryChargeReferenceStore();
  }

  private parseToken(token: string) {
    return z.string().min(1).refine((value) => !value.startsWith("replace-this-")).parse(token);
  }

  /** Token desta chamada. `options.accessToken` ganha; senão `resolveMpAccessToken` com a finalidade. */
  private async tokenFor(options: ProviderCallOptions, purpose: "charge" | "settlement") {
    if (options.accessToken) return this.parseToken(options.accessToken);
    return this.parseToken(await this.resolveAccessToken({
      businessId: options.businessId,
      mpUserId: options.mpUserId,
      purpose: options.purpose ?? purpose,
    }));
  }

  private notificationTarget() {
    if (this.notificationUrl) return this.notificationUrl;
    const configured = process.env.MERCADOPAGO_NOTIFICATION_URL?.trim();
    if (configured) return configured;
    const base = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");
    if (base) return `${base}/api/webhooks/payments/mercadopago`;
    throw new Error("notification_url ausente.");
  }

  private async request(path: string, init: { method: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal; accessToken: string }) {
    if (init.signal?.aborted) throw init.signal.reason ?? new Error("Aborted");
    if (init.signal) return this.dispatch(path, init);
    const timeoutMs = paymentsConfig().PAYMENT_PROVIDER_TIMEOUT_MS;
    return callProvider(timeoutMs, (signal) => this.dispatch(path, { ...init, signal }));
  }

  private async dispatch(path: string, init: { method: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal; accessToken: string }) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${init.accessToken}`,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      const creatingPix = init.method === "POST" && path === "/v1/payments";
      const causeCodes = creatingPix ? causeCodesFromMpBody(text) : [];
      const requestId = creatingPix ? safeMpRequestId(response.headers.get("x-request-id")) : null;
      throw new MercadoPagoHttpError(response.status, `Mercado Pago ${init.method} ${path} → ${response.status}`, causeCodes, requestId);
    }
    return text ? JSON.parse(text) as unknown : {};
  }

  private async view(payment: MpPayment, holdExpiresAt?: Date): Promise<ProviderCharge> {
    const now = this.now();
    const copyPaste = payment.point_of_interaction?.transaction_data?.qr_code
      ?? payment.point_of_interaction?.transaction_data?.ticket_url
      ?? `MP:${payment.id}`;
    const encoded = payment.point_of_interaction?.transaction_data?.qr_code_base64?.trim();
    const qrCodeDataUrl = encoded
      ? (encoded.startsWith("data:image") ? encoded : `data:image/png;base64,${encoded}`)
      : await QRCode.toDataURL(copyPaste, { width: 256, margin: 2 });
    const mpExpires = payment.date_of_expiration ? new Date(payment.date_of_expiration) : null;
    const expiresAt = holdExpiresAt
      ?? (mpExpires && !Number.isNaN(mpExpires.getTime())
        ? new Date(mpExpires.getTime() - MERCADOPAGO_PIX_EXPIRATION_MARGIN_MINUTES * 60_000)
        : new Date(now.getTime() + PIX_EXPIRATION_MIN_MINUTES * 60_000));

    let status: ProviderCharge["status"];
    if (isNoConfirm(payment)) status = "refunded";
    else if (isAccredited(payment)) status = "paid";
    else if (payment.status === "cancelled" || payment.status === "canceled" || payment.status === "rejected") status = "cancelled";
    else if (payment.status === "expired" || expiresAt <= now) status = "expired";
    else status = "pending";

    // Só `date_approved` é a hora em que o Pix foi aprovado. `date_created` é a criação da
    // cobrança e o relógio local é o processamento: nenhum dos dois prova pagamento no prazo.
    // https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/get-payment/get
    const paidAt = status === "paid" ? parseApprovalInstant(payment.date_approved) : null;

    return {
      externalId: payment.id,
      reference: payment.external_reference ?? null,
      amountCents: Math.round(payment.transaction_amount * 100),
      expiresAt,
      qrCodeDataUrl,
      copyPaste,
      status,
      paidAt,
      statusDetail: payment.status_detail ?? null,
    };
  }

  private toPix(charge: ProviderCharge, holdExpiresAt?: Date): PixCharge {
    return {
      externalId: charge.externalId,
      amountCents: charge.amountCents,
      expiresAt: holdExpiresAt ?? charge.expiresAt,
      qrCodeDataUrl: charge.qrCodeDataUrl,
      copyPaste: charge.copyPaste,
    };
  }

  async createPixCharge(input: ChargeInput, options: ProviderCallOptions = {}): Promise<PixCharge> {
    const data = chargeInputSchema.parse(input);
    const existing = await this.findChargeByReference(data.reference, options);
    if (existing) {
      if (existing.amountCents !== data.amountCents) throw new Error("Chave de idempotência reutilizada com outros dados.");
      return this.toPix(existing, data.expiresAt);
    }
    const payerCpf = payerCpfRequired() ? data.customer?.cpfCnpj : undefined;
    if (payerCpfRequired() && !payerCpf) throw new Error("CPF do pagador é obrigatório.");
    const mpExpiresAt = new Date(data.expiresAt.getTime() + MERCADOPAGO_PIX_EXPIRATION_MARGIN_MINUTES * 60_000);
    if (mpExpiresAt.getTime() - this.now().getTime() < MERCADOPAGO_PIX_MIN_EXPIRATION_MS) {
      throw new Error("Validade do Pix abaixo do mínimo do Mercado Pago.");
    }
    const names = data.customer ? splitName(data.customer.name) : { firstName: "Cliente", lastName: "AgendaPix" };
    const token = await this.tokenFor(options, "charge");
    let createdRaw: unknown;
    try {
      createdRaw = await this.request("/v1/payments", {
        method: "POST",
        signal: options.signal,
        accessToken: token,
        headers: { "X-Idempotency-Key": data.reference },
        body: {
          transaction_amount: centsToTransactionAmount(data.amountCents),
          payment_method_id: "pix",
          description: "Sinal de agendamento",
          external_reference: data.reference,
          notification_url: this.notificationTarget(),
          date_of_expiration: pixDateOfExpiration(data.expiresAt),
          payer: {
            email: payerEmail(data.customer, data.reference),
            ...(data.customer ? { first_name: names.firstName, last_name: names.lastName } : {}),
            ...(payerCpf ? { identification: { type: "CPF", number: payerCpf } } : {}),
          },
        },
      });
    } catch (error) {
      if (error instanceof MercadoPagoHttpError && error.status < 500) {
        try {
          const raced = await this.findChargeByReference(data.reference, options);
          if (raced && raced.amountCents === data.amountCents) return this.toPix(raced, data.expiresAt);
        } catch { /* a busca não apaga a recusa do POST */ }
      }
      this.warnPixCreateFailure(data.reference, options.businessId, error);
      if (error instanceof MercadoPagoHttpError && isDefinitivePixRefusal(error.status)) {
        throw new PixCreateRefusedError(error.status);
      }
      throw error;
    }
    const created = paymentSchema.parse(createdRaw);
    await this.referenceStore.save(data.reference, created.id.toLowerCase());
    // O `expiresAt` devolvido é o hold, não o `date_of_expiration` (hold + 2 min).
    return this.toPix(await this.view(created, data.expiresAt), data.expiresAt);
  }

  /** Uma linha. Sem message, description, pagador, token ou corpo. */
  private warnPixCreateFailure(paymentId: string, businessId: string | undefined, error: unknown) {
    if (error instanceof MercadoPagoHttpError) {
      logPixCreateFailure({
        businessId: businessId ?? null,
        paymentId,
        mpStatus: error.status,
        causeCodes: error.causeCodes,
        requestId: error.requestId,
        reason: classifyPixCreateRefusal(error.status, error.causeCodes),
      });
      return;
    }
    logPixCreateFailure({
      businessId: businessId ?? null,
      paymentId,
      mpStatus: null,
      causeCodes: [],
      requestId: null,
      reason: "mp_unknown",
    });
  }

  async getCharge(externalId: string, options: ProviderCallOptions = {}) {
    try {
      const token = await this.tokenFor(options, "settlement");
      const found = paymentSchema.parse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}`, {
        method: "GET", signal: options.signal, accessToken: token,
      }));
      return this.view(found);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async findChargeByReference(reference: string, options: ProviderCallOptions = {}) {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error("Aborted");
    const token = await this.tokenFor(options, "settlement");
    const withToken = { ...options, accessToken: token };
    const stored = await this.referenceStore.get(reference);
    if (stored) {
      const mapped = await this.getCharge(stored, withToken);
      if (mapped) return mapped;
    }
    const searched = searchSchema.parse(await this.request(
      `/v1/payments/search?sort=date_created&criteria=desc&external_reference=${encodeURIComponent(reference)}`,
      { method: "GET", signal: options.signal, accessToken: token },
    ));
    const payment = searched.results?.[0];
    if (!payment) return null;
    await this.referenceStore.save(reference, payment.id.toLowerCase());
    return this.view(payment);
  }

  async cancelCharge(externalId: string, options: ProviderCallOptions = {}) {
    const current = await this.getCharge(externalId, options);
    if (!current) return null;
    if (current.status === "paid" || current.status === "refunded") return current;
    const token = await this.tokenFor(options, "settlement");
    try {
      const updated = paymentSchema.parse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}`, {
        method: "PUT",
        signal: options.signal,
        accessToken: token,
        body: { status: "cancelled" },
      }));
      return this.view(updated);
    } catch (error) {
      const after = await this.getCharge(externalId, options);
      if (after?.status === "paid" || after?.status === "refunded") return after;
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Estorno total: POST /v1/payments/{id}/refunds, corpo sem `amount`, com o mesmo token da criação.
   * https://www.mercadopago.com.br/developers/pt/reference/chargebacks/_payments_id_refunds/post
   */
  async refundCharge(externalId: string, input: { idempotencyKey: string }, options: ProviderCallOptions = {}): Promise<RefundResult | null> {
    const idempotencyKey = z.string().min(8).max(64).parse(input.idempotencyKey);
    const current = await this.getCharge(externalId, options);
    if (!current) return null;
    if (current.status === "refunded") return { status: "refunded", refundId: null };
    if (current.status !== "paid") throw new Error("Só é possível estornar uma cobrança paga.");
    const token = await this.tokenFor(options, "settlement");
    try {
      const refunded = refundSchema.parse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}/refunds`, {
        method: "POST",
        signal: options.signal,
        accessToken: token,
        headers: {
          "X-Idempotency-Key": idempotencyKey,
          "X-Render-In-Process-Refunds": "true",
        },
        body: {},
      }));
      const status = (refunded.status ?? "").toLowerCase();
      const refundId = refunded.id != null ? String(refunded.id) : null;
      if (status === "approved" || status === "refunded" || status === "processed") return { status: "refunded", refundId };
      if (status === "in_process" || status === "pending") return { status: "in_process", refundId };
      throw new Error(status ? `Estorno recusado (${status}).` : "Estorno recusado.");
    } catch (error) {
      const after = await this.getCharge(externalId, options);
      if (after?.status === "refunded") return { status: "refunded", refundId: null };
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
    const tsMs = mercadoPagoTimestampMs(parsedSig.ts);
    if (tsMs === null || Math.abs(now.getTime() - tsMs) > MERCADOPAGO_WEBHOOK_FRESHNESS_MS) throw invalid();

    const topic = payload.type ?? new URL(requestUrl ?? "http://localhost").searchParams.get("type") ?? "";
    if (topic && topic !== "payment") throw new IgnoredWebhookEvent(topic);
    if (!dataId) throw new z.ZodError([]);

    const mpUserId = payload.user_id != null ? String(payload.user_id) : undefined;
    let payment;
    try {
      // Sem signal, cada HTTP usa PAYMENT_PROVIDER_TIMEOUT_MS. O MP espera o ack em até 22s.
      // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
      payment = await this.getCharge(dataId, { mpUserId, purpose: "settlement" });
    } catch (error) {
      if (error instanceof MpAccountNotConnectedError) throw new UnverifiableSellerPayment(dataId);
      throw error;
    }
    if (!payment) throw new HttpError(404, "payment_not_found", "Pagamento não encontrado.");
    if (payment.status === "refunded") throw new ObservedRefundEvent(payment.externalId);
    if (payment.status !== "paid") throw new IgnoredWebhookEvent(payload.action ?? payment.statusDetail ?? payment.status);
    const notificationId = payload.id != null ? String(payload.id) : `payment:${payment.externalId}`;
    return paidEventSchema.parse({
      eventId: `mp:${notificationId}`,
      type: "payment.paid",
      externalId: payment.externalId,
      amountCents: payment.amountCents,
      paidAt: (knownApproval(payment.paidAt) ? payment.paidAt! : now).toISOString(),
      paidAtSource: knownApproval(payment.paidAt) ? "date_approved" : "fallback",
      ...(payment.statusDetail ? { statusDetail: payment.statusDetail } : {}),
    });
  }
}
