import { z } from "zod";
import { HttpError } from "../http";
import { FakePaymentProvider } from "./fake";
import { getDb } from "../../db";
import { MERCADOPAGO_BASE_URL, MercadoPagoPaymentProvider, resolveMpAccessToken } from "./mercadopago";
import { registerSellerAccountHooks } from "./register-seller-hooks";
import type { PaymentProvider } from "./provider";
import { DatabaseChargeReferenceStore } from "./reference-store";

const unavailable = () => new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
const secret = z.string().min(32).refine((value) => !value.startsWith("replace-this-"));

const mercadoPagoEnvSchema = z.object({
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1).refine((value) => !value.startsWith("replace-this-")),
  MERCADOPAGO_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  MERCADOPAGO_WEBHOOK_SECRET: secret,
  MERCADOPAGO_BASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
});

/**
 * PAYMENT_PROVIDER=fake|mercadopago. Fora de produção o padrão é fake.
 * Em produção o fake é recusado e o Mercado Pago exige ACCESS_TOKEN + WEBHOOK_SECRET.
 */
export function getPaymentProvider(env: Readonly<Record<string, string | undefined>> = process.env): PaymentProvider {
  const production = env.NODE_ENV === "production";
  const requested = env.PAYMENT_PROVIDER?.trim() || (production ? "" : "fake");
  if (requested === "mercadopago") {
    const parsed = mercadoPagoEnvSchema.safeParse(env);
    if (!parsed.success) throw unavailable();
    registerSellerAccountHooks();
    return new MercadoPagoPaymentProvider({
      accessToken: parsed.data.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: parsed.data.MERCADOPAGO_WEBHOOK_SECRET,
      env: parsed.data.MERCADOPAGO_ENV,
      baseUrl: parsed.data.MERCADOPAGO_BASE_URL ?? MERCADOPAGO_BASE_URL,
      notificationUrl: env.MERCADOPAGO_NOTIFICATION_URL || undefined,
      resolveAccessToken: (query) => resolveMpAccessToken(query, env),
      // Durável e compartilhado entre instâncias serverless; a conexão só abre no primeiro uso.
      referenceStore: new DatabaseChargeReferenceStore("mercadopago", getDb),
    });
  }
  if (requested === "fake" && !production) {
    const parsed = secret.safeParse(env.FAKE_WEBHOOK_SECRET);
    if (!parsed.success) throw unavailable();
    return new FakePaymentProvider(parsed.data);
  }
  throw unavailable();
}
