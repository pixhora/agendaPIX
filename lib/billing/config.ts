import { z } from "zod";

type Env = Readonly<Record<string, string | undefined>>;

/** E.164 sem "+": 8 a 15 dígitos, sem zero à esquerda. */
const whatsappNumber = z.string().regex(/^[1-9][0-9]{7,14}$/);
/** Inteiro >= 1, sem zero à esquerda e sem parte fracionária. */
const activationHours = z.string().regex(/^[1-9][0-9]*$/).transform(Number).refine((value) => Number.isSafeInteger(value));

const manualCheckoutEnvSchema = z.object({
  SUPPORT_WHATSAPP_NUMBER: whatsappNumber,
  SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: activationHours,
});

export type ManualCheckoutConfig =
  | { available: true; whatsappNumber: string; activationHours: number }
  | { available: false; unavailableReason: "config_missing"; whatsappNumber: null; activationHours: null };

/**
 * Lê as duas envs da ativação manual. Não há padrão: qualquer ausência ou valor inválido
 * deixa o checkout indisponível, sem lançar na importação do módulo.
 */
export function readManualCheckoutConfig(env: Env = process.env): ManualCheckoutConfig {
  const parsed = manualCheckoutEnvSchema.safeParse({
    SUPPORT_WHATSAPP_NUMBER: env.SUPPORT_WHATSAPP_NUMBER,
    SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: env.SUBSCRIPTION_MANUAL_ACTIVATION_HOURS,
  });
  if (!parsed.success) {
    return { available: false, unavailableReason: "config_missing", whatsappNumber: null, activationHours: null };
  }
  return { available: true, whatsappNumber: parsed.data.SUPPORT_WHATSAPP_NUMBER, activationHours: parsed.data.SUBSCRIPTION_MANUAL_ACTIVATION_HOURS };
}
