import { z } from "zod";

/**
 * Contrato BE-26, resposta de `GET /api/businesses/{businessId}/billing`.
 * O backend atual (#29) ainda não manda `checkout`. Ausência vira indisponível.
 * O front não monta o link do WhatsApp: o POST responde 303 e o back escolhe número e texto.
 */
const pendingRequestSchema = z.object({}).catchall(z.unknown());

const checkoutFields = {
  available: z.boolean(),
  unavailableReason: z.string().nullable(),
  activationHours: z.number().int().nonnegative().nullable(),
  pendingRequest: pendingRequestSchema.nullable(),
} as const;

export type PendingSubscriptionRequest = z.infer<typeof pendingRequestSchema>;

export type SubscriptionCheckout = {
  available: boolean;
  unavailableReason: string | null;
  activationHours: number | null;
  pendingRequest: PendingSubscriptionRequest | null;
};

/** Mais de 3 dias até o fim do período ativo esconde o POST (409 do contrato §4). No 3º dia o botão continua. */
export const CHECKOUT_BLOCK_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

/** Frase provisória, até o Pincel fechar o texto. */
export const SUBSCRIPTION_UNAVAILABLE_COPY = "A assinatura está temporariamente indisponível. Tente de novo mais tarde.";

export const SUBSCRIPTION_ACTIVE_TOAST = "Assinatura ativa. Seus agendamentos online voltaram.";

export const SUBSCRIPTION_WHATSAPP_LABEL = "Falar no WhatsApp de novo";

export function absentCheckout(): SubscriptionCheckout {
  return { available: false, unavailableReason: null, activationHours: null, pendingRequest: null };
}

/** Lê `checkout` sem derrubar o restante da cobrança. Objeto ausente ou `available` inválido vira o padrão. */
export function parseCheckout(value: unknown): SubscriptionCheckout {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return absentCheckout();
  const record = value as Record<string, unknown>;
  const available = checkoutFields.available.safeParse(record.available);
  if (!available.success) return absentCheckout();
  const unavailableReason = checkoutFields.unavailableReason.safeParse(record.unavailableReason ?? null);
  const activationHours = checkoutFields.activationHours.safeParse(record.activationHours ?? null);
  const pendingRequest = checkoutFields.pendingRequest.safeParse(record.pendingRequest ?? null);
  return {
    available: available.data,
    unavailableReason: unavailableReason.success ? unavailableReason.data : null,
    activationHours: activationHours.success ? activationHours.data : null,
    pendingRequest: pendingRequest.success ? pendingRequest.data : null,
  };
}

export function subscriptionCheckoutAction(businessId: string) {
  const id = z.uuid().safeParse(businessId);
  if (!id.success) return null;
  return `/api/businesses/${id.data}/subscription/checkout`;
}

export function checkoutBlockedBySubscription(
  subscription: { status: string; currentPeriodEnd: string | null } | null,
  now: Date,
) {
  if (!subscription || subscription.status !== "active" || !subscription.currentPeriodEnd) return false;
  const end = new Date(subscription.currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return false;
  return end - now.getTime() > CHECKOUT_BLOCK_AFTER_MS;
}

export type PausedSubscriptionCta =
  | { kind: "subscribe" }
  | { kind: "pending"; activationHours: number | null; allowResend: boolean }
  | { kind: "unavailable" }
  | { kind: "blocked" };

export function pausedSubscriptionCta(
  input: {
    checkout: SubscriptionCheckout;
    subscription: { status: string; currentPeriodEnd: string | null } | null;
  },
  now: Date,
): PausedSubscriptionCta {
  const blocked = checkoutBlockedBySubscription(input.subscription, now);
  if (input.checkout.pendingRequest) {
    return { kind: "pending", activationHours: input.checkout.activationHours, allowResend: !blocked };
  }
  if (blocked) return { kind: "blocked" };
  if (input.checkout.available) return { kind: "subscribe" };
  return { kind: "unavailable" };
}

export function pendingActivationCopy(activationHours: number | null) {
  if (activationHours == null) return "Recebemos seu pedido.";
  return `Recebemos seu pedido. Ativamos em até ${activationHours} h.`;
}

/** Toast uma vez, só na passagem de pedido pendente para assinatura ativa. */
export function subscriptionActivatedToast(wasPending: boolean, pendingNow: boolean, activeNow: boolean) {
  if (pendingNow || !wasPending || !activeNow) return null;
  return SUBSCRIPTION_ACTIVE_TOAST;
}
