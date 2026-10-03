import { z } from "zod";
import { HttpError } from "../http";
import { FakePaymentProvider } from "./fake";

export function getPaymentProvider() {
  const env = z.object({ PAYMENT_PROVIDER: z.literal("fake"), FAKE_WEBHOOK_SECRET: z.string().min(32) }).safeParse(process.env);
  if (!env.success || process.env.NODE_ENV === "production" || env.data.FAKE_WEBHOOK_SECRET.startsWith("replace-this-")) {
    throw new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
  }
  return new FakePaymentProvider(env.data.FAKE_WEBHOOK_SECRET);
}
