import { createManualSubscriptionProvider } from "./manual";
import type { SubscriptionProvider, SubscriptionProviderId } from "./types";

type ManualEnv = Parameters<typeof createManualSubscriptionProvider>[0];

/** Hoje só o manual entra no mapa. `pix_platform` existe como tipo e não é registrado. */
export function activeSubscriptionProvider(env?: ManualEnv): SubscriptionProvider {
  return createManualSubscriptionProvider(env ?? process.env);
}

export function registeredSubscriptionProvider(id: SubscriptionProviderId, env?: ManualEnv): SubscriptionProvider | null {
  if (id === "manual") return createManualSubscriptionProvider(env ?? process.env);
  return null;
}

export function registeredSubscriptionProviderIds(): SubscriptionProviderId[] {
  return ["manual"];
}
