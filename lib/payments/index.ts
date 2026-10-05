import { z } from "zod";
import { HttpError } from "../http";
import { FakePaymentProvider } from "./fake";
import type { PaymentProvider } from "./provider";
import { WOOVI_BASE_URLS, WooviPaymentProvider } from "./woovi";

const unavailable = () => new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
const secret = z.string().min(32).refine((value) => !value.startsWith("replace-this-"));

const wooviEnvSchema = z.object({
  WOOVI_AUTH_TOKEN: z.string().min(1).refine((value) => !value.startsWith("replace-this-")),
  WOOVI_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  WOOVI_BASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
  WOOVI_WEBHOOK_SECRET: secret,
  WOOVI_WEBHOOK_PUBLIC_KEY: z.preprocess((value) => (value === "" ? undefined : value), z.string().optional()),
});

/** Aceita PEM direto ou PEM em base64 (formato publicado pela Woovi). */
function decodePem(value: string | undefined) {
  if (!value) return undefined;
  return value.includes("BEGIN PUBLIC KEY") ? value : Buffer.from(value, "base64").toString("utf8");
}

/**
 * PAYMENT_PROVIDER=fake|woovi. Fora de produção o padrão é fake.
 * Em produção o fake é recusado e a Woovi exige WOOVI_AUTH_TOKEN + WOOVI_WEBHOOK_SECRET.
 */
export function getPaymentProvider(env: Readonly<Record<string, string | undefined>> = process.env): PaymentProvider {
  const production = env.NODE_ENV === "production";
  const requested = env.PAYMENT_PROVIDER?.trim() || (production ? "" : "fake");
  if (requested === "woovi") {
    const parsed = wooviEnvSchema.safeParse(env);
    if (!parsed.success) throw unavailable();
    const baseUrl = parsed.data.WOOVI_BASE_URL ?? WOOVI_BASE_URLS[parsed.data.WOOVI_ENV];
    return new WooviPaymentProvider({ appId: parsed.data.WOOVI_AUTH_TOKEN, baseUrl, webhookSecret: parsed.data.WOOVI_WEBHOOK_SECRET, webhookPublicKeyPem: decodePem(parsed.data.WOOVI_WEBHOOK_PUBLIC_KEY) });
  }
  if (requested === "fake" && !production) {
    const parsed = secret.safeParse(env.FAKE_WEBHOOK_SECRET);
    if (!parsed.success) throw unavailable();
    return new FakePaymentProvider(parsed.data);
  }
  throw unavailable();
}
