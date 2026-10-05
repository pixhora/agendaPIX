import { createHmac, createVerify, timingSafeEqual } from "node:crypto";
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

export const WOOVI_BASE_URLS = {
  sandbox: "https://api.woovi-sandbox.com",
  production: "https://api.woovi.com",
} as const;
export type WooviEnv = keyof typeof WOOVI_BASE_URLS;
export type WooviFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Woovi exige expiresIn >= 5 min. O hold da reserva continua sendo a fonte da verdade (reconciliador cancela). */
export const WOOVI_MIN_EXPIRES_IN_SECONDS = 300;

export type WooviPaymentProviderOptions = {
  /** AppID gerado no painel Woovi (header Authorization). */
  appId: string;
  baseUrl: string;
  /** Secret do webhook: HMAC-SHA1 base64 do corpo bruto no header X-OpenPix-Signature. */
  webhookSecret: string;
  /** Opcional: chave pública (PEM) para validar também x-webhook-signature (RSA-SHA256). */
  webhookPublicKeyPem?: string;
  fetchImpl?: WooviFetch;
  now?: () => Date;
};

const wooviChargeSchema = z.object({
  correlationID: z.string().min(1).max(200),
  value: z.number().int().positive(),
  status: z.enum(["ACTIVE", "COMPLETED", "EXPIRED"]),
  brCode: z.string().min(1).max(4096).optional().nullable(),
  expiresDate: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
}).passthrough();
type WooviCharge = z.infer<typeof wooviChargeSchema>;
const chargeEnvelopeSchema = z.object({ charge: wooviChargeSchema }).passthrough();

const webhookSchema = z.object({
  event: z.string().min(1).optional(),
  charge: z.object({
    correlationID: z.string().min(1).max(200),
    value: z.number().int().positive(),
    status: z.string().optional(),
    paidAt: z.string().optional().nullable(),
  }).passthrough().optional(),
  pix: z.object({
    time: z.string().optional().nullable(),
    value: z.number().int().positive().optional(),
  }).passthrough().optional(),
}).passthrough();

class WooviHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "WooviHttpError"; }
}

function isNotFound(error: unknown) {
  return error instanceof WooviHttpError && (error.status === 404 || (error.status === 400 && /not found|não encontrad|nao encontrad/i.test(error.message)));
}

function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function signWooviWebhook(body: string, secret: string) {
  return createHmac("sha1", secret).update(body).digest("base64");
}

function phoneDigits(e164: string) {
  return e164.replace(/\D/g, "");
}

export class WooviPaymentProvider implements PaymentProvider {
  readonly name = "woovi";
  private readonly appId: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;
  private readonly webhookPublicKeyPem?: string;
  private readonly fetchImpl: WooviFetch;
  private readonly now: () => Date;

  constructor(options: WooviPaymentProviderOptions) {
    this.appId = z.string().min(1).parse(options.appId);
    this.baseUrl = z.url().parse(options.baseUrl).replace(/\/+$/, "");
    this.webhookSecret = z.string().min(16).refine((value) => !value.startsWith("replace-this-")).parse(options.webhookSecret);
    this.webhookPublicKeyPem = options.webhookPublicKeyPem;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? (() => new Date());
  }

  private async request(path: string, init: { method: string; body?: unknown; signal?: AbortSignal }) {
    if (init.signal?.aborted) throw init.signal.reason ?? new Error("Aborted");
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: { Authorization: this.appId, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new WooviHttpError(response.status, `Woovi ${init.method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) as unknown : {};
  }

  private async view(charge: WooviCharge): Promise<ProviderCharge> {
    const now = this.now();
    const expiresAt = charge.expiresDate ? new Date(charge.expiresDate) : now;
    const copyPaste = charge.brCode ?? `WOOVI:${charge.correlationID}`;
    const status: ProviderCharge["status"] = charge.status === "COMPLETED" ? "paid"
      : charge.status === "EXPIRED" || expiresAt <= now ? "expired" : "pending";
    const paidRaw = charge.paidAt ?? (status === "paid" ? charge.updatedAt : null);
    return {
      externalId: charge.correlationID,
      reference: charge.correlationID,
      amountCents: charge.value,
      expiresAt,
      // QR gerado localmente a partir do brCode: a Woovi pode devolver qrCodeImage como URL ou base64.
      qrCodeDataUrl: await QRCode.toDataURL(copyPaste, { width: 256, margin: 2 }),
      copyPaste,
      status,
      paidAt: status === "paid" ? (paidRaw ? new Date(paidRaw) : now) : null,
    };
  }

  private toPix(charge: ProviderCharge): PixCharge {
    return { externalId: charge.externalId, amountCents: charge.amountCents, expiresAt: charge.expiresAt, qrCodeDataUrl: charge.qrCodeDataUrl, copyPaste: charge.copyPaste };
  }

  async createPixCharge(input: ChargeInput, options: ProviderCallOptions = {}): Promise<PixCharge> {
    const data = chargeInputSchema.parse(input);
    // Idempotência: correlationID = payment.id. Consulta ANTES de qualquer outra validação/criação,
    // para que retries (timeout, reconciliador sem dados do pagador) sempre recuperem a cobrança existente.
    const existing = await this.findChargeByReference(data.reference, options);
    if (existing) {
      if (existing.amountCents !== data.amountCents) throw new Error("Chave de idempotência reutilizada com outros dados.");
      return this.toPix(existing);
    }
    const expiresIn = Math.max(WOOVI_MIN_EXPIRES_IN_SECONDS, Math.ceil((data.expiresAt.getTime() - this.now().getTime()) / 1000));
    try {
      const created = chargeEnvelopeSchema.parse(await this.request("/api/v1/charge", {
        method: "POST",
        signal: options.signal,
        body: {
          correlationID: data.reference,
          value: data.amountCents,
          comment: "Sinal de agendamento",
          expiresIn,
          // Woovi não exige pagador; quando há dados, envia name+taxID+phone (combinação aceita pela API).
          ...(data.customer ? { customer: { name: data.customer.name, taxID: data.customer.cpfCnpj, phone: phoneDigits(data.customer.phone), ...(data.customer.email ? { email: data.customer.email } : {}) } } : {}),
        },
      }));
      return this.toPix(await this.view(created.charge));
    } catch (error) {
      // Corrida: outra tentativa criou o mesmo correlationID entre a consulta e o POST.
      if (error instanceof WooviHttpError && error.status < 500) {
        const raced = await this.findChargeByReference(data.reference, options);
        if (raced && raced.amountCents === data.amountCents) return this.toPix(raced);
      }
      throw error;
    }
  }

  async getCharge(externalId: string, options: ProviderCallOptions = {}) {
    try {
      const found = chargeEnvelopeSchema.parse(await this.request(`/api/v1/charge/${encodeURIComponent(externalId)}`, { method: "GET", signal: options.signal }));
      return this.view(found.charge);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /** correlationID é a nossa referência; GET /api/v1/charge/{id} aceita correlationID. */
  findChargeByReference(reference: string, options: ProviderCallOptions = {}) {
    return this.getCharge(reference, options);
  }

  async cancelCharge(externalId: string, options: ProviderCallOptions = {}) {
    const current = await this.getCharge(externalId, options);
    if (!current) return null;
    if (current.status === "paid") return current;
    try {
      await this.request(`/api/v1/charge/${encodeURIComponent(externalId)}`, { method: "DELETE", signal: options.signal });
    } catch (error) {
      if (!isNotFound(error)) {
        // Pode ter sido paga entre a consulta e o DELETE: nunca reportar paga como cancelada.
        const after = await this.getCharge(externalId, options);
        if (after?.status === "paid") return after;
        throw error;
      }
    }
    const after = await this.getCharge(externalId, options);
    if (after?.status === "paid") return after;
    return { ...current, status: "cancelled" as const };
  }

  verifyWebhook(body: string, headers: Headers, now: Date) {
    const invalid = () => new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
    const signature = headers.get("x-openpix-signature") ?? "";
    if (!/^[A-Za-z0-9+/]{27}=$/.test(signature) || !constantTimeEqual(signature, signWooviWebhook(body, this.webhookSecret))) throw invalid();
    if (this.webhookPublicKeyPem) {
      const rsa = headers.get("x-webhook-signature") ?? "";
      let valid = false;
      try {
        const verifier = createVerify("sha256");
        verifier.update(body);
        verifier.end();
        valid = rsa.length > 0 && verifier.verify(this.webhookPublicKeyPem, rsa, "base64");
      } catch { valid = false; }
      if (!valid) throw invalid();
    }
    const payload = webhookSchema.parse(JSON.parse(body));
    // Só CHARGE_COMPLETED confirma; demais eventos (teste do painel, CHARGE_CREATED/EXPIRED...) são autenticados e ignorados.
    if (payload.event !== "OPENPIX:CHARGE_COMPLETED") throw new IgnoredWebhookEvent(payload.event ?? "unknown");
    if (!payload.charge) throw new z.ZodError([]);
    const paidRaw = payload.charge.paidAt ?? payload.pix?.time ?? null;
    return paidEventSchema.parse({
      // Uma cobrança completa uma única vez: id estável entre reentregas.
      eventId: `CHARGE_COMPLETED:${payload.charge.correlationID}`,
      type: "payment.paid",
      externalId: payload.charge.correlationID,
      amountCents: payload.pix?.value ?? payload.charge.value,
      paidAt: (paidRaw ? new Date(paidRaw) : now).toISOString(),
    });
  }
}
