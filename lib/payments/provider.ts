import { z } from "zod";
import { centsSchema } from "../validation/service";

export const chargeInputSchema = z.object({
  idempotencyKey: z.uuid({ version: "v4" }),
  amountCents: centsSchema.refine((value) => value > 0, "A cobrança deve ser positiva."),
  expiresAt: z.date(),
});
export const pixChargeSchema = z.object({
  externalId: z.string().min(1).max(200),
  amountCents: centsSchema.refine((value) => value > 0),
  expiresAt: z.date(),
  qrCodeDataUrl: z.string().startsWith("data:image/png;base64,"),
  copyPaste: z.string().min(1).max(4096),
});
export const paidEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  type: z.literal("payment.paid"),
  externalId: z.string().min(1).max(200),
  amountCents: centsSchema.refine((value) => value > 0),
  paidAt: z.iso.datetime({ offset: true }),
}).strict();

export type PaidEvent = z.infer<typeof paidEventSchema>;
export interface PaymentProvider {
  readonly name: string;
  createPixCharge(input: z.infer<typeof chargeInputSchema>): Promise<z.infer<typeof pixChargeSchema>>;
  verifyWebhook(body: string, headers: Headers, now: Date): PaidEvent;
}
