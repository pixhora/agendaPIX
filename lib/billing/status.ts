import { z } from "zod";
import { getDb } from "../../db";
import { HttpError } from "../http";
import { findOwnedBusiness } from "../tenancy";
import { loadBookingAccess } from "./load";

const BASE_PLAN = { name: "AgendaPix", priceCents: 4900 } as const;

export async function getBusinessBilling(businessId: string, ownerId: string, database: Pick<ReturnType<typeof getDb>, "select"> = getDb()) {
  const id = z.uuid().parse(businessId);
  const business = await findOwnedBusiness(id, ownerId, database);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  const access = await loadBookingAccess(business, database);
  return {
    state: access.state,
    trialEndsAt: access.trialEndsAt,
    daysLeft: access.daysLeft,
    bookingsPaused: access.bookingsPaused,
    plan: BASE_PLAN,
    subscription: access.subscription
      ? { status: access.subscription.status, currentPeriodEnd: access.subscription.currentPeriodEnd, provider: access.subscription.provider ?? null }
      : null,
  };
}
