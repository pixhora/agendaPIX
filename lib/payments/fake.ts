import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { HttpError } from "../http";
import { chargeInputSchema, paidEventSchema, type PaymentProvider } from "./provider";

export function signFakeWebhook(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  private readonly secret: string;
  constructor(secret: string) {
    this.secret = z.string().min(32).refine((value) => !value.startsWith("replace-this-")).parse(secret);
  }
  async createPixCharge(input: Parameters<PaymentProvider["createPixCharge"]>[0]) {
    const data = chargeInputSchema.parse(input);
    const externalId = `fake_${data.idempotencyKey}`;
    const copyPaste = `FAKE-PIX-NOT-PAYABLE:${externalId}:${data.amountCents}`;
    return { externalId, amountCents: data.amountCents, expiresAt: data.expiresAt, copyPaste,
      qrCodeDataUrl: await QRCode.toDataURL(copyPaste, { width: 256, margin: 2 }) };
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
