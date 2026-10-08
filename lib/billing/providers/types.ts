export const subscriptionProviderIds = ["manual", "pix_platform"] as const;

export type SubscriptionProviderId = (typeof subscriptionProviderIds)[number];

export type SubscriptionCheckoutContext = {
  publicUrl: string;
};

export type ManualCheckoutStart = {
  provider: "manual";
  whatsappUrl: string;
  activationHours: number;
};

/**
 * Resultado futuro do Pix mensal da plataforma. O provedor não está registrado:
 * ninguém instancia este ramo hoje.
 */
export type PixPlatformCheckoutStart = {
  provider: "pix_platform";
};

export type SubscriptionCheckoutStart = ManualCheckoutStart | PixPlatformCheckoutStart;

export interface SubscriptionProvider {
  readonly id: SubscriptionProviderId;
  isAvailable(): boolean;
  startCheckout(ctx: SubscriptionCheckoutContext): SubscriptionCheckoutStart;
}
