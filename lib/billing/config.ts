import { z } from "zod";
import { readSupportWhatsappNumber } from "../support-contact";

type Env = Readonly<Record<string, string | undefined>>;

/** Inteiro >= 1, sem zero à esquerda e sem parte fracionária. */
const activationHours = z.string().regex(/^[1-9][0-9]*$/).transform(Number).refine((value) => Number.isSafeInteger(value));

export type ManualCheckoutConfig =
  | { available: true; whatsappNumber: string; activationHours: number }
  | { available: false; unavailableReason: "config_missing"; whatsappNumber: null; activationHours: null };

/**
 * Lê as duas envs da ativação manual. Não há padrão: qualquer ausência ou valor inválido
 * deixa o checkout indisponível, sem lançar na importação do módulo.
 */
export function readManualCheckoutConfig(env: Env = process.env): ManualCheckoutConfig {
  const whatsappNumber = readSupportWhatsappNumber(env);
  const hours = activationHours.safeParse(env.SUBSCRIPTION_MANUAL_ACTIVATION_HOURS);
  if (!whatsappNumber || !hours.success) {
    return { available: false, unavailableReason: "config_missing", whatsappNumber: null, activationHours: null };
  }
  return { available: true, whatsappNumber, activationHours: hours.data };
}
