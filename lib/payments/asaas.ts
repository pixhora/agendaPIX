import { timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { HttpError } from "../http";
import {
  chargeCustomerSchema,
  chargeInputSchema,
  paidEventSchema,
  type ChargeInput,
  type PaymentProvider,
  type PixCharge,
  type ProviderCallOptions,
  type ProviderCharge,
} from "./provider";

export const ASAAS_BASE_URLS = {
  sandbox: "https://api-sandbox.asaas.com",
  production: "https://api.asaas.com",
} as const;

export type AsaasEnv = keyof typeof ASAAS_BASE_URLS;
export type AsaasFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type AsaasPaymentProviderOptions = {
  apiKey: string;
  env: AsaasEnv;
  webhookToken: string;
  fetchImpl?: AsaasFetch;
  userAgent?: string;
};

const asaasPaymentStatus = z.enum([
  "PENDING", "RECEIVED", "CONFIRMED", "OVERDUE", "REFUNDED", "RECEIVED_IN_CASH",
  "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL", "DUNNING_REQUESTED", "DUNNING_RECEIVED", "AWAITING_RISK_ANALYSIS",
]);

const asaasPaymentSchema = z.object({
  id: z.string().min(1),
  value: z.number(),
  status: asaasPaymentStatus,
  dueDate: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  confirmedDate: z.string().optional().nullable(),
  clientPaymentDate: z.string().optional().nullable(),
  externalReference: z.string().optional().nullable(),
  deleted: z.boolean().optional().nullable(),
}).passthrough();

const asaasListSchema = z.object({ data: z.array(asaasPaymentSchema).default([]) }).passthrough();
const asaasCustomerSchema = z.object({ id: z.string().min(1) }).passthrough();
const asaasCustomerListSchema = z.object({ data: z.array(asaasCustomerSchema).default([]) }).passthrough();
const asaasPixQrSchema = z.object({
  encodedImage: z.string().min(1),
  payload: z.string().min(1),
  expirationDate: z.string().optional().nullable(),
}).passthrough();
const asaasDeleteSchema = z.object({ deleted: z.boolean().optional(), id: z.string().optional() }).passthrough();

const paidWebhookEvents = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);


function assertAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Aborted");
}

function reaisToCents(value: number) {
  return Math.round(value * 100);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Converte data Asaas (`YYYY-MM-DD` ou `YYYY-MM-DD HH:mm:ss`) para Date. */
export function parseAsaasDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = Date.parse(withZone);
  return Number.isFinite(parsed) ? new Date(parsed) : fallback;
}

function mapStatus(payment: z.infer<typeof asaasPaymentSchema>, now: Date): ProviderCharge["status"] {
  if (payment.deleted) return "cancelled";
  if (payment.status === "RECEIVED" || payment.status === "CONFIRMED" || payment.status === "RECEIVED_IN_CASH") return "paid";
  if (payment.status === "OVERDUE") return "expired";
  if (
    payment.status === "REFUNDED" || payment.status === "REFUND_REQUESTED" || payment.status === "REFUND_IN_PROGRESS"
    || payment.status === "CHARGEBACK_REQUESTED" || payment.status === "CHARGEBACK_DISPUTE"
    || payment.status === "AWAITING_CHARGEBACK_REVERSAL"
  ) return "cancelled";
  if (payment.status === "PENDING") {
    const due = payment.dueDate ? parseAsaasDate(`${payment.dueDate}T23:59:59`, now) : null;
    if (due && due < now) return "expired";
    return "pending";
  }
  return "pending";
}

function paidAtOf(payment: z.infer<typeof asaasPaymentSchema>, now: Date): Date | null {
  const raw = payment.paymentDate ?? payment.confirmedDate ?? payment.clientPaymentDate;
  if (!raw) return mapStatus(payment, now) === "paid" ? now : null;
  return parseAsaasDate(raw, now);
}

function safeEqualToken(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function mobilePhoneDigits(e164: string) {
  const digits = e164.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

export class AsaasPaymentProvider implements PaymentProvider {
  readonly name = "asaas";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly webhookToken: string;
  private readonly fetchImpl: AsaasFetch;
  private readonly userAgent: string;

  constructor(options: AsaasPaymentProviderOptions) {
    this.apiKey = z.string().min(1).parse(options.apiKey);
    this.webhookToken = z.string().min(32).max(255)
      .refine((value) => !/\s/.test(value), "Token do webhook inválido.")
      .parse(options.webhookToken);
    this.baseUrl = ASAAS_BASE_URLS[options.env];
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? "agendaPIX/1.0";
  }

  private async raw(path: string, init: RequestInit & { signal?: AbortSignal }) {
    assertAbort(init.signal);
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        access_token: this.apiKey,
        "User-Agent": this.userAgent,
        ...(init.headers ?? {}),
      },
      signal: init.signal,
    });
  }

  private async request<T>(path: string, init: RequestInit & { signal?: AbortSignal }, schema: z.ZodType<T>): Promise<T> {
    const response = await this.raw(path, init);
    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 300);
      try { detail = JSON.stringify(JSON.parse(text)); } catch { /* keep */ }
      const error = new Error(`Asaas ${init.method ?? "GET"} ${path} → ${response.status}: ${detail}`);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    if (!text) return schema.parse({});
    return schema.parse(JSON.parse(text));
  }

  private async ensureCustomer(input: ChargeInput, signal?: AbortSignal) {
    const customer = chargeCustomerSchema.parse(input.customer);
    const listed = await this.request(
      `/v3/customers?cpfCnpj=${encodeURIComponent(customer.cpfCnpj)}&limit=1`,
      { method: "GET", signal },
      asaasCustomerListSchema,
    );
    if (listed.data[0]?.id) return listed.data[0].id;
    const created = await this.request("/v3/customers", {
      method: "POST",
      signal,
      body: JSON.stringify({
        name: customer.name,
        cpfCnpj: customer.cpfCnpj,
        mobilePhone: mobilePhoneDigits(customer.phone),
        ...(customer.email ? { email: customer.email } : {}),
        notificationDisabled: true,
      }),
    }, asaasCustomerSchema);
    return created.id;
  }

  private async pixQr(externalId: string, signal?: AbortSignal) {
    const qr = await this.request(`/v3/payments/${encodeURIComponent(externalId)}/pixQrCode`, { method: "GET", signal }, asaasPixQrSchema);
    const png = qr.encodedImage.startsWith("data:image/png;base64,")
      ? qr.encodedImage
      : qr.encodedImage.startsWith("data:")
        ? await QRCode.toDataURL(qr.payload, { width: 256, margin: 2 })
        : `data:image/png;base64,${qr.encodedImage}`;
    return {
      copyPaste: qr.payload,
      qrCodeDataUrl: png,
      expiresAt: qr.expirationDate ? parseAsaasDate(qr.expirationDate, new Date()) : null,
    };
  }

  private async toProviderCharge(payment: z.infer<typeof asaasPaymentSchema>, signal?: AbortSignal, now = new Date()): Promise<ProviderCharge> {
    const status = mapStatus(payment, now);
    let qr: Awaited<ReturnType<AsaasPaymentProvider["pixQr"]>> | null = null;
    if (status === "pending" || status === "paid") {
      try { qr = await this.pixQr(payment.id, signal); } catch { qr = null; }
    }
    const expiresAt = qr?.expiresAt ?? (payment.dueDate ? parseAsaasDate(`${payment.dueDate}T23:59:59`, now) : now);
    const fallbackCopy = `ASAAS:${payment.id}`;
    const qrCodeDataUrl = qr?.qrCodeDataUrl ?? await QRCode.toDataURL(fallbackCopy, { width: 256, margin: 2 });
    return {
      externalId: payment.id,
      reference: payment.externalReference ?? null,
      amountCents: reaisToCents(payment.value),
      expiresAt,
      qrCodeDataUrl,
      copyPaste: qr?.copyPaste ?? fallbackCopy,
      status,
      paidAt: paidAtOf(payment, now),
    };
  }

  private async toPixCharge(payment: z.infer<typeof asaasPaymentSchema>, signal?: AbortSignal, fallbackExpiresAt?: Date): Promise<PixCharge> {
    const qr = await this.pixQr(payment.id, signal);
    return {
      externalId: payment.id,
      amountCents: reaisToCents(payment.value),
      expiresAt: qr.expiresAt ?? fallbackExpiresAt ?? (payment.dueDate ? parseAsaasDate(`${payment.dueDate}T23:59:59`, new Date()) : new Date()),
      qrCodeDataUrl: qr.qrCodeDataUrl,
      copyPaste: qr.copyPaste,
    };
  }

  async createPixCharge(input: ChargeInput, options: ProviderCallOptions = {}) {
    const data = chargeInputSchema.parse(input);
    if (!data.customer) {
      throw new HttpError(400, "cpf_required", "Informe um CPF válido para gerar a cobrança Pix.");
    }
    // Idempotência emulada: Asaas não expõe header nativo; reusa cobrança com o mesmo externalReference (payment.id).
    const existing = await this.findChargeByReference(data.reference, options);
    if (existing) {
      if (existing.amountCents !== data.amountCents) throw new Error("Chave de idempotência reutilizada com outros dados.");
      if (existing.status === "pending" || existing.status === "paid") {
        return {
          externalId: existing.externalId,
          amountCents: existing.amountCents,
          expiresAt: existing.expiresAt,
          qrCodeDataUrl: existing.qrCodeDataUrl,
          copyPaste: existing.copyPaste,
        };
      }
    }
    const customerId = await this.ensureCustomer(data, options.signal);
    const payment = await this.request("/v3/payments", {
      method: "POST",
      signal: options.signal,
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: data.amountCents / 100,
        dueDate: dateOnly(data.expiresAt),
        externalReference: data.reference,
        description: `Sinal agendaPIX ${data.reference}`,
      }),
    }, asaasPaymentSchema);
    return this.toPixCharge(payment, options.signal, data.expiresAt);
  }

  async getCharge(externalId: string, options: ProviderCallOptions = {}) {
    try {
      const payment = await this.request(`/v3/payments/${encodeURIComponent(externalId)}`, { method: "GET", signal: options.signal }, asaasPaymentSchema);
      return this.toProviderCharge(payment, options.signal);
    } catch (error) {
      if (typeof error === "object" && error && "status" in error && (error as { status?: number }).status === 404) return null;
      throw error;
    }
  }

  async findChargeByReference(reference: string, options: ProviderCallOptions = {}) {
    const listed = await this.request(
      `/v3/payments?externalReference=${encodeURIComponent(reference)}&limit=1`,
      { method: "GET", signal: options.signal },
      asaasListSchema,
    );
    const payment = listed.data[0];
    if (!payment) return null;
    return this.toProviderCharge(payment, options.signal);
  }

  async cancelCharge(externalId: string, options: ProviderCallOptions = {}) {
    const current = await this.getCharge(externalId, options);
    if (!current) return null;
    if (current.status === "paid") return current;
    try {
      await this.request(`/v3/payments/${encodeURIComponent(externalId)}`, { method: "DELETE", signal: options.signal }, asaasDeleteSchema);
    } catch (error) {
      if (!(typeof error === "object" && error && "status" in error && (error as { status?: number }).status === 404)) throw error;
    }
    const after = await this.getCharge(externalId, options);
    if (after) return after;
    return { ...current, status: "cancelled" as const };
  }

  async verifyWebhook(body: string, headers: Headers, now: Date) {
    const token = headers.get("asaas-access-token") ?? "";
    if (!token || !safeEqualToken(token, this.webhookToken)) {
      throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
    }
    let raw: unknown;
    try { raw = JSON.parse(body); }
    catch { throw new SyntaxError("JSON inválido"); }

    const envelope = z.object({
      id: z.string().min(1).max(200),
      event: z.string().min(1),
      payment: z.object({ id: z.string().min(1) }).passthrough(),
    }).passthrough().parse(raw);

    if (!paidWebhookEvents.has(envelope.event)) {
      throw new HttpError(400, "invalid_event", "Evento inválido.");
    }

    const partial = envelope.payment as Record<string, unknown>;
    const hasValue = typeof partial.value === "number";
    const hasPaidMarker = Boolean(partial.paymentDate || partial.confirmedDate || partial.clientPaymentDate || partial.status === "RECEIVED" || partial.status === "CONFIRMED");

    if (!hasValue || !hasPaidMarker) {
      const fetched = await this.getCharge(String(partial.id));
      if (!fetched || fetched.status !== "paid" || !fetched.paidAt) throw new HttpError(400, "invalid_event", "Evento inválido.");
      return paidEventSchema.parse({
        eventId: envelope.id,
        type: "payment.paid",
        externalId: fetched.externalId,
        amountCents: fetched.amountCents,
        paidAt: fetched.paidAt.toISOString(),
      });
    }

    const payment = asaasPaymentSchema.parse({
      id: partial.id,
      value: partial.value,
      status: partial.status ?? "RECEIVED",
      paymentDate: partial.paymentDate,
      confirmedDate: partial.confirmedDate,
      clientPaymentDate: partial.clientPaymentDate,
      dueDate: partial.dueDate,
      externalReference: partial.externalReference,
      deleted: partial.deleted,
    });
    const paidAt = paidAtOf(payment, now);
    if (!paidAt) throw new HttpError(400, "invalid_event", "Evento inválido.");

    return paidEventSchema.parse({
      eventId: envelope.id,
      type: "payment.paid",
      externalId: payment.id,
      amountCents: reaisToCents(payment.value),
      paidAt: paidAt.toISOString(),
    });
  }
}
