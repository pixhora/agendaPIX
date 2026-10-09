import { z } from "zod";
import { centsSchema } from "../validation/service";

export const chargeCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  email: z.email().max(120).optional(),
  /** Só vai em `payer.identification` quando `MP_REQUIRES_PAYER_CPF=true`. */
  cpfCnpj: z.string().regex(/^\d{11}$/).optional(),
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
  status: z.enum(["pending", "paid", "expired", "cancelled", "refunded"]),
  paidAt: z.date().nullable(),
  statusDetail: z.string().min(1).max(80).nullable().optional(),
});
export const refundResultSchema = z.object({
  status: z.enum(["refunded", "in_process"]),
  refundId: z.string().min(1).max(200).nullable(),
});
export const paidEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  type: z.literal("payment.paid"),
  externalId: z.string().min(1).max(200),
  amountCents: centsSchema.refine((value) => value > 0),
  paidAt: z.iso.datetime({ offset: true }),
  /** `status_detail` do Mercado Pago, gravado em `payment_audit`. */
  statusDetail: z.string().min(1).max(80).optional(),
}).strict();

export type ChargeInput = z.infer<typeof chargeInputSchema>;
export type PixCharge = z.infer<typeof pixChargeSchema>;
export type ProviderCharge = z.infer<typeof providerChargeSchema>;
export type RefundResult = z.infer<typeof refundResultSchema>;
export type PaidEvent = z.infer<typeof paidEventSchema>;
/** Entrega autenticada de um evento que não confirma pagamento: responde 200 sem gravar nada. */
export class IgnoredWebhookEvent extends Error {
  constructor(readonly event: string) { super(`Evento ignorado: ${event}`); this.name = "IgnoredWebhookEvent"; }
}
/** O Mercado Pago avisou que o pagamento está estornado. Não confirma a reserva. */
export class ObservedRefundEvent extends Error {
  constructor(readonly externalId: string) { super("Estorno observado."); this.name = "ObservedRefundEvent"; }
}
/** Webhook assinado, mas sem token para consultar o pagamento. Não confirma às cegas. */
export class UnverifiableSellerPayment extends Error {
  constructor(readonly externalId: string) { super("Pagamento não verificável."); this.name = "UnverifiableSellerPayment"; }
}
/**
 * Toda chamada de rede recebe um AbortSignal; o domínio aplica timeout e aborta chamadas lentas.
 * `accessToken` escolhe a conta Mercado Pago da chamada (create, consulta, cancelamento, estorno).
 * Ausente: o cliente usa o token da plataforma passado no construtor. OAuth do dono entra aqui depois.
 */
export type ProviderCallOptions = {
  signal?: AbortSignal;
  /** Substitui o token resolvido só nesta chamada. */
  accessToken?: string;
  /** Negócio da reserva. O resolver de OAuth usa isto para achar o token do dono. */
  businessId?: string;
  /** `user_id` / `collector_id` do webhook Mercado Pago. */
  mpUserId?: string;
  /** `charge` cria Pix; `settlement` consulta e estorna com o token retido. */
  purpose?: "charge" | "settlement";
};

/**
 * Contrato agnóstico de gateway. Implementações reais (Mercado Pago, etc.) devem:
 * - ser idempotentes em createPixCharge pela idempotencyKey (nativo ou emulado via findChargeByReference);
 * - devolver null quando o gateway não conhece a cobrança;
 * - nunca cancelar cobrança paga (cancelCharge devolve o estado resultante, inclusive "paid");
 * - estornar no máximo uma vez por idempotencyKey (refundCharge de cobrança já estornada devolve "refunded").
 */
export interface PaymentProvider {
  readonly name: string;
  createPixCharge(input: ChargeInput, options?: ProviderCallOptions): Promise<PixCharge>;
  getCharge(externalId: string, options?: ProviderCallOptions): Promise<ProviderCharge | null>;
  findChargeByReference(reference: string, options?: ProviderCallOptions): Promise<ProviderCharge | null>;
  cancelCharge(externalId: string, options?: ProviderCallOptions): Promise<ProviderCharge | null>;
  /** Estorno total. `in_process` significa que o gateway aceitou e ainda não liquidou. */
  refundCharge(externalId: string, input: { idempotencyKey: string }, options?: ProviderCallOptions): Promise<RefundResult | null>;
  /** Pode ser assíncrono: gateways cujo webhook traz só o id (Mercado Pago) precisam consultar a cobrança para normalizar o evento. */
  /** `requestUrl` carrega query params (ex.: data.id do webhook MP) quando a assinatura depende da URL. */
  verifyWebhook(body: string, headers: Headers, now: Date, requestUrl?: string): PaidEvent | Promise<PaidEvent>;
}

/** Evento sintético e determinístico para pagamentos descobertos por consulta (reconciliação). */
export function polledPaidEvent(charge: ProviderCharge, digest: (value: string) => string): PaidEvent {
  if (charge.status !== "paid" || !charge.paidAt) throw new Error("Cobrança não paga.");
  const id = charge.externalId.length <= 190 ? charge.externalId : digest(charge.externalId);
  return paidEventSchema.parse({
    eventId: `poll:${id}`, type: "payment.paid", externalId: charge.externalId, amountCents: charge.amountCents, paidAt: charge.paidAt.toISOString(),
    ...(charge.statusDetail ? { statusDetail: charge.statusDetail } : {}),
  });
}
