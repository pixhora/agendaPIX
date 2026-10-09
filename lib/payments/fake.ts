import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { HttpError } from "../http";
import { chargeInputSchema, paidEventSchema, type ChargeInput, type PaymentProvider, type ProviderCallOptions, type ProviderCharge } from "./provider";

export function signFakeWebhook(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

type StoredCharge = ProviderCharge & { idempotencyKey: string };

/**
 * Estado do gateway simulado. O padrão é um armazenamento por processo: o servidor web e o processo de
 * reconciliação não compartilham cobranças fake (o gateway real é a fonte da verdade entre processos).
 */
export class FakeChargeStore {
  readonly byIdempotencyKey = new Map<string, StoredCharge>();
  readonly calls = { create: 0, get: 0, find: 0, cancel: 0, refund: 0 };
  get chargeCount() { return this.byIdempotencyKey.size; }
  findByExternalId(externalId: string) { return [...this.byIdempotencyKey.values()].find((charge) => charge.externalId === externalId); }
  findByReference(reference: string) { return [...this.byIdempotencyKey.values()].find((charge) => charge.reference === reference); }
}
const processStore = new FakeChargeStore();

function view(charge: StoredCharge, now = new Date()): ProviderCharge {
  const { idempotencyKey: _key, ...rest } = charge;
  void _key;
  return { ...rest, status: rest.status === "pending" && rest.expiresAt <= now ? "expired" : rest.status };
}

function wait(ms: number, signal?: AbortSignal) {
  if (ms <= 0 && !signal?.aborted) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(signal?.reason); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  readonly store: FakeChargeStore;
  latencyMs: number;
  /** `fail` não muda a cobrança. `in_process` aceita o estorno sem marcar `refunded`. */
  refundMode: "refunded" | "in_process" | "fail" = "refunded";
  private readonly secret: string;
  private readonly refunds = new Map<string, { status: "refunded" | "in_process"; refundId: string }>();
  constructor(secret: string, options: { store?: FakeChargeStore; latencyMs?: number } = {}) {
    this.secret = z.string().min(32).refine((value) => !value.startsWith("replace-this-")).parse(secret);
    this.store = options.store ?? processStore;
    this.latencyMs = options.latencyMs ?? 0;
  }
  async createPixCharge(input: ChargeInput, options: ProviderCallOptions = {}) {
    const data = chargeInputSchema.parse(input);
    this.store.calls.create++;
    await wait(this.latencyMs, options.signal);
    const existing = this.store.byIdempotencyKey.get(data.idempotencyKey);
    if (existing) {
      // Como gateways reais: mesma chave com outros parâmetros é erro, nunca uma segunda cobrança.
      if (existing.amountCents !== data.amountCents || existing.reference !== data.reference) throw new Error("Chave de idempotência reutilizada com outros dados.");
      return view(existing);
    }
    const externalId = `fake_${data.idempotencyKey}`;
    const copyPaste = `FAKE-PIX-NOT-PAYABLE:${externalId}:${data.amountCents}`;
    const charge: StoredCharge = { idempotencyKey: data.idempotencyKey, externalId, reference: data.reference, amountCents: data.amountCents, expiresAt: data.expiresAt,
      copyPaste, qrCodeDataUrl: await QRCode.toDataURL(copyPaste, { width: 256, margin: 2 }), status: "pending", paidAt: null };
    this.store.byIdempotencyKey.set(data.idempotencyKey, charge);
    return view(charge);
  }
  async getCharge(externalId: string, options: ProviderCallOptions = {}) {
    this.store.calls.get++;
    await wait(this.latencyMs, options.signal);
    const charge = this.store.findByExternalId(externalId);
    return charge ? view(charge) : null;
  }
  async findChargeByReference(reference: string, options: ProviderCallOptions = {}) {
    this.store.calls.find++;
    await wait(this.latencyMs, options.signal);
    const charge = this.store.findByReference(reference);
    return charge ? view(charge) : null;
  }
  async cancelCharge(externalId: string, options: ProviderCallOptions = {}) {
    this.store.calls.cancel++;
    await wait(this.latencyMs, options.signal);
    const charge = this.store.findByExternalId(externalId);
    if (!charge) return null;
    if (charge.status !== "paid" && charge.status !== "refunded") charge.status = "cancelled";
    return view(charge);
  }
  async refundCharge(externalId: string, input: { idempotencyKey: string }, options: ProviderCallOptions = {}) {
    await wait(this.latencyMs, options.signal);
    const charge = this.store.findByExternalId(externalId);
    if (!charge) return null;
    const existing = this.refunds.get(input.idempotencyKey);
    if (existing) return existing;
    if (charge.status === "refunded") return { status: "refunded" as const, refundId: `fake_ref_${input.idempotencyKey}` };
    if (charge.status !== "paid") throw new Error("Só é possível estornar uma cobrança paga.");
    if (this.refundMode === "fail") throw new Error("collector has insufficient available balance");
    this.store.calls.refund++;
    if (this.refundMode === "in_process") {
      const pending = { status: "in_process" as const, refundId: `fake_ref_${input.idempotencyKey}` };
      this.refunds.set(input.idempotencyKey, pending);
      return pending;
    }
    charge.status = "refunded";
    const result = { status: "refunded" as const, refundId: `fake_ref_${input.idempotencyKey}` };
    this.refunds.set(input.idempotencyKey, result);
    return result;
  }
  /**
   * Simulação local: marca a cobrança como paga, como faria o banco do pagador.
   * `paidAt` é o instante de aprovação (o `date_approved` do Mercado Pago). O padrão é a hora
   * desta chamada. Quem simula webhook ou reconciliação atrasados precisa passar a hora real
   * do pagamento; o processamento posterior não reescreve esse instante. Não há rota pública.
   */
  markPaid(externalId: string, paidAt = new Date()) {
    const charge = this.store.findByExternalId(externalId);
    if (!charge) throw new Error("Cobrança fake desconhecida.");
    if (charge.status === "cancelled") throw new Error("Cobrança cancelada não pode ser paga.");
    charge.status = "paid";
    charge.paidAt = paidAt;
    return view(charge);
  }
  verifyWebhook(body: string, headers: Headers, now: Date) {
    const timestamp = headers.get("x-fake-timestamp") ?? "";
    const signature = headers.get("x-fake-signature") ?? "";
    if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature) || Math.abs(now.getTime() / 1000 - Number(timestamp)) > 300) {
      throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
    }
    const expected = signFakeWebhook(body, timestamp, this.secret);
    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
      throw new HttpError(401, "invalid_signature", "Assinatura inválida ou vencida.");
    }
    return paidEventSchema.parse(JSON.parse(body));
  }
}
