import { z } from "zod";
import { HttpError } from "../http";

const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);
const int = (min: number, max: number, fallback: number) => z.preprocess(blankAsUndefined, z.coerce.number().int().min(min).max(max).default(fallback));

export const paymentsEnvSchema = z.object({
  PAYMENT_PROVIDER_TIMEOUT_MS: int(100, 60000, 8000),
  RECONCILE_INTERVAL_SECONDS: int(5, 3600, 60),
  RECONCILE_STUCK_SECONDS: int(10, 3600, 60),
  RECONCILE_BATCH_SIZE: int(1, 1000, 50),
});
export type PaymentsConfig = z.infer<typeof paymentsEnvSchema>;

export function paymentsConfig(env: Readonly<Record<string, string | undefined>> = process.env): PaymentsConfig {
  const parsed = paymentsEnvSchema.safeParse(env);
  if (!parsed.success) throw new HttpError(503, "payment_unavailable", "Cobrança indisponível. Tente novamente mais tarde.");
  return parsed.data;
}
