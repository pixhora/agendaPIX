import { HttpError } from "../../http";
import { readManualCheckoutConfig, type ManualCheckoutConfig } from "../config";
import { manualWhatsappUrl } from "../public-url";
import type { SubscriptionCheckoutContext, SubscriptionProvider } from "./types";

type ManualEnv = Parameters<typeof readManualCheckoutConfig>[0];

export function createManualSubscriptionProvider(env: ManualEnv = process.env): SubscriptionProvider {
  return {
    id: "manual",
    isAvailable() {
      return readManualCheckoutConfig(env).available;
    },
    startCheckout(ctx: SubscriptionCheckoutContext) {
      const config = readManualCheckoutConfig(env);
      if (!config.available) {
        throw new HttpError(503, "checkout_unavailable", "A assinatura por aqui está indisponível no momento.");
      }
      return manualCheckoutStart(config, ctx.publicUrl);
    },
  };
}

function manualCheckoutStart(config: Extract<ManualCheckoutConfig, { available: true }>, publicUrl: string) {
  return {
    provider: "manual" as const,
    whatsappUrl: manualWhatsappUrl(config.whatsappNumber, publicUrl),
    activationHours: config.activationHours,
  };
}

export const manualSubscriptionProvider = createManualSubscriptionProvider();
