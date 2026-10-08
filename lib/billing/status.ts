import { z } from "zod";
import { getDb } from "../../db";
import { HttpError } from "../http";
import { findOwnedBusiness } from "../tenancy";
import { readManualCheckoutConfig } from "./config";
import { loadBookingAccess } from "./load";
import { activeSubscriptionProvider } from "./providers";
import { loadOpenSubscriptionRequest } from "./requests";

const BASE_PLAN = { name: "AgendaPix", priceCents: 4900 } as const;

export async function getBusinessBilling(
  businessId: string,
  ownerId: string,
  database: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const id = z.uuid().parse(businessId);
  const business = await findOwnedBusiness(id, ownerId, database);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  const access = await loadBookingAccess(business, database);
  const config = readManualCheckoutConfig(env);
  const provider = activeSubscriptionProvider(env);
  const pending = await loadOpenSubscriptionRequest(business.id, database);
  const available = config.available && provider.isAvailable();
  return {
    state: access.state,
    trialEndsAt: access.trialEndsAt,
    daysLeft: access.daysLeft,
    bookingsPaused: access.bookingsPaused,
    plan: BASE_PLAN,
    subscription: access.subscription
      ? { status: access.subscription.status, currentPeriodEnd: access.subscription.currentPeriodEnd, provider: access.subscription.provider ?? null }
      : null,
    checkout: {
      provider: "manual" as const,
      available,
      unavailableReason: available ? null : "config_missing" as const,
      activationHours: available && config.available ? config.activationHours : null,
      pendingRequest: pending ? { id: pending.id, requestedAt: pending.requestedAt.toISOString() } : null,
    },
  };
}
