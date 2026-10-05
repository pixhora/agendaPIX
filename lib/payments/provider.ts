import { z } from "zod";
import { isValidCpf } from "../validation/cpf";
import { centsSchema } from "../validation/service";

export const chargeCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  /** CPF com 11 dígitos (enviado ao gateway; no MP vai em `payer.identification`). */
  cpfCnpj: z.string().regex(/^\d{11}$/).refine(isValidCpf, "CPF inválido."),
  email: z.email().max(120).optional(),
}).strict();

export const chargeInputSchema = z.object({
  idempotencyKey: z.uuid({ version: "v4" }),
  /** Nosso id de pagamento: no MP vira `external_reference` e `X-Idempotency-Key`. */
  reference: z.uuid(),
  amountCents: centsSchema.refine((value) => value > 0, "A cobrança deve ser positiva."),
  expiresAt: z.date(),
  /** Dados do pagador (opcional para o gateway; ausente em retries do reconciliador). */
  customer: chargeCustomerSchema.optional(),
});
export const pixChargeSchema = z.object({
  externalId: z.string().min(1).max(200),
  amountCents: centsSchema.refine((value) => value > 0),
  expiresAt: z.date(),
  qrCodeDataUrl: z.string().startsWith("data:image/png;base64,"),
  copyPaste: z.string().min(1).max(4096),
});
export const providerChargeSchema = pixChargeSchema.extend({
  reference: z.string().min(1).max(200).nullable(),
  status: z.enum(["pending", "paid", "expired", "cancelled"]),
  paidAt: z.date().nullable(),
});
export const paidEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  type: z.literal("payment.paid"),
  externalId: z.string().min(1).max(200),
  amountCents: centsSchema.refine((value) => value > 0),
  paidAt: z.iso.datetime({ offset: true }),
}).strict();

export type ChargeInput = z.infer<typeof chargeInputSchema>;
export type PixCharge = z.infer<typeof pixChargeSchema>;
export type ProviderCharge = z.infer<typeof providerChargeSchema>;
export type PaidEvent = z.infer<typeof paidEventSchema>;
/** Entrega autenticada de um evento que não confirma pagamento: responde 200 sem gravar nada. */
export class IgnoredWebhookEvent extends Error {
  constructor(readonly event: string) { super(`Evento ignorado: ${event}`); this.name = "IgnoredWebhookEvent"; }
}
/** Toda chamada de rede recebe um AbortSignal; o domínio aplica timeout e aborta chamadas lentas. */
export type ProviderCallOptions = { signal?: AbortSignal };

/**
 * Contrato agnóstico de gateway. Implementações reais (Mercado Pago, etc.) devem:
 * - ser idempotentes em createPixCharge pela idempotencyKey (nativo ou emulado via findChargeByReference);
 * - devolver null quando o gateway não conhece a cobrança;
 * - nunca cancelar cobrança paga (cancelCharge devolve o estado resultante, inclusive "paid").
 */
export interface PaymentProvider {
  readonly name: string;
  createPixCharge(input: ChargeInput, options?: ProviderCallOptions): Promise<PixCharge>;
  getCharge(externalId: string, options?: ProviderCallOptions): Promise<ProviderCharge | null>;
  findChargeByReference(reference: string, options?: ProviderCallOptions): Promise<ProviderCharge | null>;
  cancelCharge(externalId: string, options?: ProviderCallOptions): Promise<ProviderCharge | null>;
  /** Pode ser assíncrono: gateways cujo webhook traz só o id (Mercado Pago) precisam consultar a cobrança para normalizar o evento. */
  /** `requestUrl` carrega query params (ex.: data.id do webhook MP) quando a assinatura depende da URL. */
  verifyWebhook(body: string, headers: Headers, now: Date, requestUrl?: string): PaidEvent | Promise<PaidEvent>;
}

/** Evento sintético e determinístico para pagamentos descobertos por consulta (reconciliação). */
export function polledPaidEvent(charge: ProviderCharge, digest: (value: string) => string): PaidEvent {
  if (charge.status !== "paid" || !charge.paidAt) throw new Error("Cobrança não paga.");
  const id = charge.externalId.length <= 190 ? charge.externalId : digest(charge.externalId);
  return paidEventSchema.parse({ eventId: `poll:${id}`, type: "payment.paid", externalId: charge.externalId, amountCents: charge.amountCents, paidAt: charge.paidAt.toISOString() });
}
