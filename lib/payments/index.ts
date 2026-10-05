import { z } from "zod";
import { HttpError } from "../http";
import { AsaasPaymentProvider, type AsaasEnv } from "./asaas";
import { FakePaymentProvider } from "./fake";
import type { PaymentProvider } from "./provider";

const fakeEnvSchema = z.object({
  PAYMENT_PROVIDER: z.literal("fake").default("fake"),
  FAKE_WEBHOOK_SECRET: z.string().min(32),
});

const asaasEnvSchema = z.object({
  PAYMENT_PROVIDER: z.literal("asaas"),
  ASAAS_API_KEY: z.string().min(1),
  ASAAS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  ASAAS_WEBHOOK_TOKEN: z.string().min(32).max(255).refine((value) => !/\s/.test(value), "Token do webhook inválido."),
});

/**
 * Seleciona o gateway. Fora de produção o padrão é `fake`.
 * Em produção o fake é recusado; exige `PAYMENT_PROVIDER=asaas` + `ASAAS_API_KEY`.
 */
export function getPaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  const requested = (env.PAYMENT_PROVIDER || (env.NODE_ENV === "production" ? "" : "fake")).trim();
  if (requested === "asaas") {
    const parsed = asaasEnvSchema.safeParse({ ...env, PAYMENT_PROVIDER: "asaas" });
    if (!parsed.success) {
      throw new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
    }
    return new AsaasPaymentProvider({
      apiKey: parsed.data.ASAAS_API_KEY,
      env: parsed.data.ASAAS_ENV as AsaasEnv,
      webhookToken: parsed.data.ASAAS_WEBHOOK_TOKEN,
    });
  }
  if (requested === "fake") {
    if (env.NODE_ENV === "production") {
      throw new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
    }
    const parsed = fakeEnvSchema.safeParse({ ...env, PAYMENT_PROVIDER: "fake" });
    if (!parsed.success || parsed.data.FAKE_WEBHOOK_SECRET.startsWith("replace-this-")) {
      throw new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
    }
    return new FakePaymentProvider(parsed.data.FAKE_WEBHOOK_SECRET);
  }
  throw new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
}
